package com.agenthive.payment.service.impl;

import com.agenthive.payment.domain.entity.CreditsTransaction;
import com.agenthive.payment.domain.entity.MarketplaceOrder;
import com.agenthive.payment.domain.entity.MarketplaceProduct;
import com.agenthive.payment.domain.entity.MarketplacePurchase;
import com.agenthive.payment.domain.enums.CreditsTransactionType;
import com.agenthive.payment.domain.enums.MarketplaceOrderStatus;
import com.agenthive.payment.domain.enums.MarketplaceProductStatus;
import com.agenthive.payment.domain.enums.PayChannel;
import com.agenthive.payment.domain.enums.PaymentChannel;
import com.agenthive.payment.domain.vo.MarketplaceOrderVO;
import com.agenthive.payment.internal.common.BusinessException;
import com.agenthive.payment.mapper.CreditsTransactionMapper;
import com.agenthive.payment.mapper.MarketplaceOrderMapper;
import com.agenthive.payment.mapper.MarketplaceProductMapper;
import com.agenthive.payment.mapper.MarketplacePurchaseMapper;
import com.agenthive.payment.service.CreditsAccountService;
import com.agenthive.payment.service.MarketplaceOrderService;
import com.agenthive.payment.service.PaymentService;
import com.agenthive.payment.service.dto.CreateOrderRequest;
import com.agenthive.payment.service.dto.CreatePaymentRequest;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class MarketplaceOrderServiceImpl implements MarketplaceOrderService {

    private final MarketplaceOrderMapper orderMapper;
    private final MarketplaceProductMapper productMapper;
    private final MarketplacePurchaseMapper purchaseMapper;
    private final CreditsAccountService creditsAccountService;
    private final CreditsTransactionMapper creditsTransactionMapper;
    private final PaymentService paymentService;

    @Value("${platform.fee.rate:0.20}")
    private BigDecimal platformFeeRate;

    private static final Long PLATFORM_USER_ID = 0L;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public MarketplaceOrderVO createOrder(CreateOrderRequest request) {
        MarketplaceProduct product = productMapper.selectById(request.getProductId());
        if (product == null) {
            throw new BusinessException("商品不存在");
        }
        if (!MarketplaceProductStatus.ACTIVE.name().equals(product.getStatus())) {
            throw new BusinessException("商品已下架");
        }

        // 校验是否已购买
        int purchased = purchaseMapper.countByBuyerAndProduct(request.getBuyerId(), request.getProductId());
        if (purchased > 0) {
            throw new BusinessException("已购买该商品，请勿重复购买");
        }

        BigDecimal price = PayChannel.CREDITS.name().equals(request.getPayChannel())
                ? product.getCreditsPrice()
                : product.getPrice();
        if (price == null || price.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("商品价格无效");
        }

        BigDecimal platformFee = price.multiply(platformFeeRate).setScale(4, RoundingMode.HALF_UP);
        BigDecimal sellerEarn = price.subtract(platformFee);

        MarketplaceOrder order = new MarketplaceOrder();
        order.setOrderNo(generateOrderNo());
        order.setBuyerId(request.getBuyerId());
        order.setSellerId(product.getSellerId());
        order.setProductId(product.getId());
        order.setProductType(product.getType());
        order.setProductName(product.getName());
        order.setPrice(price);
        order.setPlatformFee(platformFee);
        order.setSellerEarn(sellerEarn);
        order.setStatus(MarketplaceOrderStatus.PENDING.name());
        order.setPayChannel(request.getPayChannel());
        order.setCreatedAt(LocalDateTime.now());
        orderMapper.insert(order);

        log.info("Marketplace order created: orderNo={}, buyerId={}, productId={}, price={}",
                order.getOrderNo(), order.getBuyerId(), order.getProductId(), price);
        return toVO(order);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public MarketplaceOrderVO payOrder(Long orderId, String payChannel) {
        MarketplaceOrder order = orderMapper.selectById(orderId);
        if (order == null) {
            throw new BusinessException("订单不存在");
        }
        if (!MarketplaceOrderStatus.PENDING.name().equals(order.getStatus())) {
            throw new BusinessException("订单状态不允许支付");
        }

        if (PayChannel.CREDITS.name().equals(payChannel)) {
            // Credits 支付：扣减买家 -> 卖家入账 -> 平台入账
            creditsAccountService.debit(order.getBuyerId(), order.getPrice(),
                    CreditsTransactionType.SPEND_AGENT, "MARKETPLACE", order.getOrderNo(),
                    "购买商品: " + order.getProductName());

            creditsAccountService.credit(order.getSellerId(), order.getSellerEarn(),
                    CreditsTransactionType.EARN_SALE, "MARKETPLACE_ORDER", order.getOrderNo(),
                    "商品销售收入: " + order.getProductName());

            creditsAccountService.credit(PLATFORM_USER_ID, order.getPlatformFee(),
                    CreditsTransactionType.FEE, "MARKETPLACE_ORDER", order.getOrderNo(),
                    "平台抽成: " + order.getProductName());

        } else if (PayChannel.FIAT.name().equals(payChannel)) {
            // 法币支付：创建支付单（同步模拟成功）
            CreatePaymentRequest paymentRequest = new CreatePaymentRequest();
            paymentRequest.setUserId(order.getBuyerId());
            paymentRequest.setOrderNo(order.getOrderNo());
            paymentRequest.setAmount(order.getPrice());
            paymentRequest.setChannel(PaymentChannel.ALIPAY); // 默认渠道
            paymentService.createPayment(paymentRequest);

            // 卖家和平台获得 credits
            creditsAccountService.credit(order.getSellerId(), order.getSellerEarn(),
                    CreditsTransactionType.EARN_SALE, "MARKETPLACE_ORDER", order.getOrderNo(),
                    "商品销售收入(法币): " + order.getProductName());

            creditsAccountService.credit(PLATFORM_USER_ID, order.getPlatformFee(),
                    CreditsTransactionType.FEE, "MARKETPLACE_ORDER", order.getOrderNo(),
                    "平台抽成(法币): " + order.getProductName());
        } else {
            throw new BusinessException("不支持的支付渠道: " + payChannel);
        }

        // 记录购买关系
        MarketplacePurchase purchase = new MarketplacePurchase();
        purchase.setBuyerId(order.getBuyerId());
        purchase.setProductId(order.getProductId());
        purchase.setOrderId(order.getId());
        purchase.setPurchasedAt(LocalDateTime.now());
        purchaseMapper.insert(purchase);

        // 更新商品销量
        MarketplaceProduct product = productMapper.selectById(order.getProductId());
        if (product != null) {
            product.setSalesCount(product.getSalesCount() + 1);
            productMapper.updateById(product);
        }

        // 更新订单状态
        order.setStatus(MarketplaceOrderStatus.COMPLETED.name());
        order.setPayChannel(payChannel);
        order.setCompletedAt(LocalDateTime.now());
        orderMapper.updateById(order);

        log.info("Marketplace order paid: orderNo={}, payChannel={}, price={}",
                order.getOrderNo(), payChannel, order.getPrice());
        return toVO(order);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public MarketplaceOrderVO refundOrder(Long orderId) {
        MarketplaceOrder order = orderMapper.selectById(orderId);
        if (order == null) {
            throw new BusinessException("订单不存在");
        }
        if (!MarketplaceOrderStatus.COMPLETED.name().equals(order.getStatus())) {
            throw new BusinessException("只有已完成的订单才能退款");
        }

        // 幂等性检查：同一订单不重复退款
        int refundedCount = creditsTransactionMapper.countBySource(
                order.getBuyerId(), "MARKETPLACE_REFUND", order.getOrderNo());
        if (refundedCount > 0) {
            throw new BusinessException("该订单已退款，请勿重复操作");
        }

        if (PayChannel.CREDITS.name().equals(order.getPayChannel())) {
            // Credits 原路退回
            creditsAccountService.credit(order.getBuyerId(), order.getPrice(),
                    CreditsTransactionType.REFUND, "MARKETPLACE_REFUND", order.getOrderNo(),
                    "订单退款: " + order.getProductName());
        } else {
            // 法币退款：调用 PaymentService.refund
            // 简化：直接给买家退回 credits（等价的）
            creditsAccountService.credit(order.getBuyerId(), order.getPrice(),
                    CreditsTransactionType.REFUND, "MARKETPLACE_REFUND", order.getOrderNo(),
                    "订单退款(法币): " + order.getProductName());
        }

        order.setStatus(MarketplaceOrderStatus.REFUNDED.name());
        orderMapper.updateById(order);

        log.info("Marketplace order refunded: orderNo={}, price={}", order.getOrderNo(), order.getPrice());
        return toVO(order);
    }

    private String generateOrderNo() {
        return "MK" + UUID.randomUUID().toString().replace("-", "").substring(0, 16).toUpperCase();
    }

    private MarketplaceOrderVO toVO(MarketplaceOrder order) {
        MarketplaceOrderVO vo = new MarketplaceOrderVO();
        vo.setId(order.getId());
        vo.setOrderNo(order.getOrderNo());
        vo.setBuyerId(order.getBuyerId());
        vo.setSellerId(order.getSellerId());
        vo.setProductId(order.getProductId());
        vo.setProductType(order.getProductType());
        vo.setProductName(order.getProductName());
        vo.setPrice(order.getPrice());
        vo.setPlatformFee(order.getPlatformFee());
        vo.setSellerEarn(order.getSellerEarn());
        vo.setStatus(order.getStatus());
        vo.setPayChannel(order.getPayChannel());
        vo.setCreatedAt(order.getCreatedAt());
        vo.setCompletedAt(order.getCompletedAt());
        return vo;
    }
}
