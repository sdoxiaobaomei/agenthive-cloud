package com.agenthive.payment.controller;

import com.agenthive.payment.domain.vo.PaymentVO;
import com.agenthive.payment.domain.vo.RefundVO;
import com.agenthive.payment.internal.common.Result;
import com.agenthive.payment.service.PaymentService;
import com.agenthive.payment.service.dto.CallbackDTO;
import com.agenthive.payment.service.dto.CreatePaymentRequest;
import com.agenthive.payment.service.dto.RefundRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;

    @PostMapping("/create")
    public Result<PaymentVO> create(@Valid @RequestBody CreatePaymentRequest request) {
        return Result.success(paymentService.createPayment(request));
    }

    @PostMapping("/callback")
    public Result<Void> callback(@Valid @RequestBody CallbackDTO dto) {
        paymentService.handleCallback(dto);
        return Result.success();
    }

    @PostMapping("/refund")
    public Result<RefundVO> refund(@Valid @RequestBody RefundRequest request) {
        return Result.success(paymentService.refund(request));
    }

    @GetMapping("/{orderNo}")
    public Result<PaymentVO> getByOrderNo(@PathVariable String orderNo) {
        PaymentVO vo = paymentService.getPaymentByOrderNo(orderNo);
        return Result.success(vo);
    }
}
