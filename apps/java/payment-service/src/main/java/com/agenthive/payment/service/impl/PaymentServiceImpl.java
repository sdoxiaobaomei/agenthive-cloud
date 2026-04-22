package com.agenthive.payment.service.impl;

import com.agenthive.payment.domain.entity.Payment;
import com.agenthive.payment.domain.entity.Refund;
import com.agenthive.payment.domain.entity.UserWallet;
import com.agenthive.payment.domain.enums.PaymentChannel;
import com.agenthive.payment.domain.enums.PaymentStatus;
import com.agenthive.payment.domain.enums.RefundStatus;
import com.agenthive.payment.domain.vo.PaymentVO;
import com.agenthive.payment.domain.vo.RefundVO;
import com.agenthive.payment.feign.OrderFeignClient;
import com.agenthive.payment.internal.common.BusinessException;
import com.agenthive.payment.internal.common.Result;
import com.agenthive.payment.internal.common.SnowflakeIdGenerator;
import com.agenthive.payment.mapper.PaymentMapper;
import com.agenthive.payment.mapper.RefundMapper;
import com.agenthive.payment.mapper.UserWalletMapper;
import com.agenthive.payment.mq.PaymentMqProducer;
import com.agenthive.payment.service.PaymentService;
import com.agenthive.payment.service.dto.CallbackDTO;
import com.agenthive.payment.service.dto.CreatePaymentRequest;
import com.agenthive.payment.service.dto.RefundRequest;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentServiceImpl implements PaymentService {

    private final PaymentMapper paymentMapper;
    private final RefundMapper refundMapper;
    private final UserWalletMapper userWalletMapper;
    private final SnowflakeIdGenerator idGenerator;
    private final PaymentMqProducer mqProducer;
    private final RedissonClient redissonClient;
    private final OrderFeignClient orderFeignClient;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public PaymentVO createPayment(CreatePaymentRequest request) {
        // Validate order exists
        Result<Map<String, Object>> orderResult = orderFeignClient.getOrder(request.getOrderNo());
        if (orderResult == null || orderResult.getCode() != 200 || orderResult.getData() == null) {
            throw new BusinessException("订单不存在");
        }

        String paymentNo = "PAY" + idGenerator.nextIdStr();
        Payment payment = new Payment();
        payment.setPaymentNo(paymentNo);
        payment.setOrderNo(request.getOrderNo());
        payment.setUserId(request.getUserId());
        payment.setAmount(request.getAmount());
        payment.setChannel(request.getChannel());
        payment.setStatus(PaymentStatus.PENDING);
        payment.setCreatedAt(LocalDateTime.now());

        if (request.getChannel() == PaymentChannel.BALANCE) {
            String lockKey = "wallet:lock:" + request.getUserId();
            RLock lock = redissonClient.getLock(lockKey);
            try {
                boolean acquired = lock.tryLock(5, 10, TimeUnit.SECONDS);
                if (!acquired) {
                    throw new BusinessException("系统繁忙，请稍后再试");
                }
                try {
                    UserWallet wallet = userWalletMapper.selectOne(
                            new LambdaQueryWrapper<UserWallet>().eq(UserWallet::getUserId, request.getUserId()));
                    if (wallet == null) {
                        throw new BusinessException("钱包不存在");
                    }
                    if (wallet.getBalance().compareTo(request.getAmount()) < 0) {
                        throw new BusinessException("余额不足");
                    }
                    int rows = userWalletMapper.deductBalance(request.getUserId(), request.getAmount(), wallet.getVersion());
                    if (rows == 0) {
                        throw new BusinessException("扣款失败，请重试");
                    }
                    payment.setStatus(PaymentStatus.SUCCESS);
                    payment.setCompletedAt(LocalDateTime.now());
                } finally {
                    if (lock.isHeldByCurrentThread()) {
                        lock.unlock();
                    }
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new BusinessException("系统繁忙，请稍后再试");
            }
        }

        paymentMapper.insert(payment);
        mqProducer.sendPaymentCreated(paymentNo, request.getOrderNo(), request.getUserId(), request.getChannel().name());

        PaymentVO vo = new PaymentVO();
        vo.setPaymentNo(paymentNo);
        vo.setOrderNo(request.getOrderNo());
        vo.setUserId(request.getUserId());
        vo.setAmount(request.getAmount());
        vo.setChannel(request.getChannel());
        vo.setStatus(payment.getStatus());
        if (request.getChannel() != PaymentChannel.BALANCE) {
            vo.setPayUrl("https://mock-payment.agenthive.com/pay/" + paymentNo);
        }
        return vo;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void handleCallback(CallbackDTO dto) {
        Payment payment = paymentMapper.selectOne(
                new LambdaQueryWrapper<Payment>().eq(Payment::getPaymentNo, dto.getPaymentNo()));
        if (payment == null) {
            throw new BusinessException("支付单不存在");
        }
        if (payment.getStatus() == PaymentStatus.SUCCESS) {
            log.warn("Payment already success, skip callback: {}", dto.getPaymentNo());
            return;
        }
        payment.setThirdPartyNo(dto.getThirdPartyNo());
        payment.setStatus(PaymentStatus.SUCCESS);
        payment.setCompletedAt(LocalDateTime.now());
        paymentMapper.updateById(payment);
        mqProducer.sendPaymentSuccess(payment.getPaymentNo(), payment.getOrderNo(), payment.getUserId());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public RefundVO refund(RefundRequest request) {
        Payment payment = paymentMapper.selectOne(
                new LambdaQueryWrapper<Payment>().eq(Payment::getPaymentNo, request.getPaymentNo()));
        if (payment == null) {
            throw new BusinessException("支付单不存在");
        }
        if (payment.getStatus() != PaymentStatus.SUCCESS) {
            throw new BusinessException("只有已支付订单才能退款");
        }
        if (payment.getAmount().compareTo(request.getAmount()) < 0) {
            throw new BusinessException("退款金额不能大于支付金额");
        }

        String refundNo = "RFD" + idGenerator.nextIdStr();
        Refund refund = new Refund();
        refund.setRefundNo(refundNo);
        refund.setPaymentNo(request.getPaymentNo());
        refund.setAmount(request.getAmount());
        refund.setStatus(RefundStatus.SUCCESS);
        refund.setReason(request.getReason());
        refund.setCreatedAt(LocalDateTime.now());
        refund.setCompletedAt(LocalDateTime.now());
        refundMapper.insert(refund);

        if (payment.getChannel() == PaymentChannel.BALANCE) {
            String lockKey = "wallet:lock:" + payment.getUserId();
            RLock lock = redissonClient.getLock(lockKey);
            try {
                boolean acquired = lock.tryLock(5, 10, TimeUnit.SECONDS);
                if (!acquired) {
                    throw new BusinessException("系统繁忙，请稍后再试");
                }
                try {
                    UserWallet wallet = userWalletMapper.selectOne(
                            new LambdaQueryWrapper<UserWallet>().eq(UserWallet::getUserId, payment.getUserId()));
                    if (wallet == null) {
                        throw new BusinessException("钱包不存在");
                    }
                    int rows = userWalletMapper.addBalance(payment.getUserId(), request.getAmount(), wallet.getVersion());
                    if (rows == 0) {
                        throw new BusinessException("退款失败，请重试");
                    }
                } finally {
                    if (lock.isHeldByCurrentThread()) {
                        lock.unlock();
                    }
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new BusinessException("系统繁忙，请稍后再试");
            }
        }

        payment.setStatus(PaymentStatus.REFUNDED);
        paymentMapper.updateById(payment);
        mqProducer.sendPaymentRefunded(payment.getPaymentNo(), refundNo, payment.getUserId());

        RefundVO vo = new RefundVO();
        vo.setRefundNo(refundNo);
        vo.setPaymentNo(request.getPaymentNo());
        vo.setAmount(request.getAmount());
        vo.setStatus(RefundStatus.SUCCESS);
        vo.setReason(request.getReason());
        vo.setCreatedAt(refund.getCreatedAt());
        vo.setCompletedAt(refund.getCompletedAt());
        return vo;
    }

    @Override
    public PaymentVO getPaymentByOrderNo(String orderNo) {
        Payment payment = paymentMapper.selectByOrderNo(orderNo);
        if (payment == null) {
            return null;
        }
        PaymentVO vo = new PaymentVO();
        vo.setPaymentNo(payment.getPaymentNo());
        vo.setOrderNo(payment.getOrderNo());
        vo.setUserId(payment.getUserId());
        vo.setAmount(payment.getAmount());
        vo.setChannel(payment.getChannel());
        vo.setStatus(payment.getStatus());
        vo.setThirdPartyNo(payment.getThirdPartyNo());
        vo.setCreatedAt(payment.getCreatedAt());
        vo.setCompletedAt(payment.getCompletedAt());
        return vo;
    }
}
