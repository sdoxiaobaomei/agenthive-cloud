package com.agenthive.payment.service;

import com.agenthive.payment.domain.vo.PaymentVO;
import com.agenthive.payment.domain.vo.RefundVO;
import com.agenthive.payment.service.dto.CallbackDTO;
import com.agenthive.payment.service.dto.CreatePaymentRequest;
import com.agenthive.payment.service.dto.RefundRequest;

public interface PaymentService {
    PaymentVO createPayment(CreatePaymentRequest request);
    void handleCallback(CallbackDTO dto);
    RefundVO refund(RefundRequest request);
    PaymentVO getPaymentByOrderNo(String orderNo);
}
