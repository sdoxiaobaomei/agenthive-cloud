package com.agenthive.payment.service.impl;

import com.agenthive.payment.domain.entity.MarketplaceOrder;
import com.agenthive.payment.domain.entity.MarketplaceProduct;
import com.agenthive.payment.domain.entity.MarketplacePurchase;
import com.agenthive.payment.domain.enums.CreditsTransactionType;
import com.agenthive.payment.domain.enums.MarketplaceOrderStatus;
import com.agenthive.payment.domain.enums.MarketplaceProductStatus;
import com.agenthive.payment.domain.enums.PayChannel;
import com.agenthive.payment.domain.vo.MarketplaceOrderVO;
import com.agenthive.payment.internal.common.BusinessException;
import com.agenthive.payment.mapper.CreditsTransactionMapper;
import com.agenthive.payment.mapper.MarketplaceOrderMapper;
import com.agenthive.payment.mapper.MarketplaceProductMapper;
import com.agenthive.payment.mapper.MarketplacePurchaseMapper;
import com.agenthive.payment.service.CreditsAccountService;
import com.agenthive.payment.service.PaymentService;
import com.agenthive.payment.service.dto.CreateOrderRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MarketplaceOrderServiceImplTest {

    @Mock
    private MarketplaceOrderMapper orderMapper;
    @Mock
    private MarketplaceProductMapper productMapper;
    @Mock
    private MarketplacePurchaseMapper purchaseMapper;
    @Mock
    private CreditsAccountService creditsAccountService;
    @Mock
    private CreditsTransactionMapper creditsTransactionMapper;
    @Mock
    private PaymentService paymentService;

    @InjectMocks
    private MarketplaceOrderServiceImpl orderService;

    private MarketplaceProduct product;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(orderService, "platformFeeRate", new BigDecimal("0.20"));

        product = new MarketplaceProduct();
        product.setId(1L);
        product.setSellerId(200L);
        product.setType("TEMPLATE");
        product.setName("Test Template");
        product.setCreditsPrice(new BigDecimal("50.0000"));
        product.setPrice(new BigDecimal("10.00"));
        product.setStatus(MarketplaceProductStatus.ACTIVE.name());
        product.setSalesCount(0);
    }

    @Test
    void createOrder_success() {
        when(productMapper.selectById(1L)).thenReturn(product);
        when(purchaseMapper.countByBuyerAndProduct(100L, 1L)).thenReturn(0);

        CreateOrderRequest request = new CreateOrderRequest();
        request.setBuyerId(100L);
        request.setProductId(1L);
        request.setPayChannel(PayChannel.CREDITS.name());

        MarketplaceOrderVO vo = orderService.createOrder(request);

        assertNotNull(vo);
        assertEquals(100L, vo.getBuyerId());
        assertEquals(200L, vo.getSellerId());
        assertEquals(new BigDecimal("50.0000"), vo.getPrice());
        assertEquals(new BigDecimal("10.0000"), vo.getPlatformFee());
        assertEquals(new BigDecimal("40.0000"), vo.getSellerEarn());
        assertEquals(MarketplaceOrderStatus.PENDING.name(), vo.getStatus());
        verify(orderMapper).insert(any(MarketplaceOrder.class));
    }

    @Test
    void createOrder_productNotFound_throwsException() {
        when(productMapper.selectById(1L)).thenReturn(null);

        CreateOrderRequest request = new CreateOrderRequest();
        request.setBuyerId(100L);
        request.setProductId(1L);
        request.setPayChannel(PayChannel.CREDITS.name());

        BusinessException ex = assertThrows(BusinessException.class, () -> orderService.createOrder(request));
        assertEquals("商品不存在", ex.getMessage());
    }

    @Test
    void createOrder_alreadyPurchased_throwsException() {
        when(productMapper.selectById(1L)).thenReturn(product);
        when(purchaseMapper.countByBuyerAndProduct(100L, 1L)).thenReturn(1);

        CreateOrderRequest request = new CreateOrderRequest();
        request.setBuyerId(100L);
        request.setProductId(1L);
        request.setPayChannel(PayChannel.CREDITS.name());

        BusinessException ex = assertThrows(BusinessException.class, () -> orderService.createOrder(request));
        assertEquals("已购买该商品，请勿重复购买", ex.getMessage());
    }

    @Test
    void payOrder_credits_success() {
        MarketplaceOrder order = createTestOrder();
        when(orderMapper.selectById(1L)).thenReturn(order);
        when(productMapper.selectById(1L)).thenReturn(product);

        MarketplaceOrderVO vo = orderService.payOrder(1L, PayChannel.CREDITS.name());

        assertEquals(MarketplaceOrderStatus.COMPLETED.name(), vo.getStatus());
        verify(creditsAccountService).debit(eq(100L), eq(new BigDecimal("50.0000")), any(), any(), any(), any());
        verify(creditsAccountService).credit(eq(200L), eq(new BigDecimal("40.0000")), eq(CreditsTransactionType.EARN_SALE), any(), any(), any());
        verify(creditsAccountService).credit(eq(0L), eq(new BigDecimal("10.0000")), eq(CreditsTransactionType.FEE), any(), any(), any());
        verify(purchaseMapper).insert(any(MarketplacePurchase.class));
    }

    @Test
    void payOrder_fiat_success() {
        MarketplaceOrder order = createTestOrder();
        order.setPayChannel(PayChannel.FIAT.name());
        when(orderMapper.selectById(1L)).thenReturn(order);
        when(productMapper.selectById(1L)).thenReturn(product);

        MarketplaceOrderVO vo = orderService.payOrder(1L, PayChannel.FIAT.name());

        assertEquals(MarketplaceOrderStatus.COMPLETED.name(), vo.getStatus());
        verify(paymentService).createPayment(any());
        verify(creditsAccountService, never()).debit(any(), any(), any(), any(), any(), any());
    }

    @Test
    void payOrder_invalidStatus_throwsException() {
        MarketplaceOrder order = createTestOrder();
        order.setStatus(MarketplaceOrderStatus.COMPLETED.name());
        when(orderMapper.selectById(1L)).thenReturn(order);

        BusinessException ex = assertThrows(BusinessException.class, () ->
                orderService.payOrder(1L, PayChannel.CREDITS.name()));
        assertEquals("订单状态不允许支付", ex.getMessage());
    }

    @Test
    void refundOrder_credits_success() {
        MarketplaceOrder order = createTestOrder();
        order.setStatus(MarketplaceOrderStatus.COMPLETED.name());
        when(orderMapper.selectById(1L)).thenReturn(order);
        when(creditsTransactionMapper.countBySource(100L, "MARKETPLACE_REFUND", order.getOrderNo())).thenReturn(0);

        MarketplaceOrderVO vo = orderService.refundOrder(1L);

        assertEquals(MarketplaceOrderStatus.REFUNDED.name(), vo.getStatus());
        verify(creditsAccountService).credit(eq(100L), eq(new BigDecimal("50.0000")), eq(CreditsTransactionType.REFUND), any(), any(), any());
    }

    @Test
    void refundOrder_alreadyRefunded_throwsException() {
        MarketplaceOrder order = createTestOrder();
        order.setStatus(MarketplaceOrderStatus.COMPLETED.name());
        when(orderMapper.selectById(1L)).thenReturn(order);
        when(creditsTransactionMapper.countBySource(100L, "MARKETPLACE_REFUND", order.getOrderNo())).thenReturn(1);

        BusinessException ex = assertThrows(BusinessException.class, () -> orderService.refundOrder(1L));
        assertEquals("该订单已退款，请勿重复操作", ex.getMessage());
    }

    @Test
    void refundOrder_notCompleted_throwsException() {
        MarketplaceOrder order = createTestOrder();
        order.setStatus(MarketplaceOrderStatus.PENDING.name());
        when(orderMapper.selectById(1L)).thenReturn(order);

        BusinessException ex = assertThrows(BusinessException.class, () -> orderService.refundOrder(1L));
        assertEquals("只有已完成的订单才能退款", ex.getMessage());
    }

    private MarketplaceOrder createTestOrder() {
        MarketplaceOrder order = new MarketplaceOrder();
        order.setId(1L);
        order.setOrderNo("MK1234567890ABCDEF");
        order.setBuyerId(100L);
        order.setSellerId(200L);
        order.setProductId(1L);
        order.setProductType("TEMPLATE");
        order.setProductName("Test Template");
        order.setPrice(new BigDecimal("50.0000"));
        order.setPlatformFee(new BigDecimal("10.0000"));
        order.setSellerEarn(new BigDecimal("40.0000"));
        order.setStatus(MarketplaceOrderStatus.PENDING.name());
        order.setPayChannel(PayChannel.CREDITS.name());
        return order;
    }
}
