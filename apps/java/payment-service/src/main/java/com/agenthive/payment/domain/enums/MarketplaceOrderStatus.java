package com.agenthive.payment.domain.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum MarketplaceOrderStatus {
    PENDING("待支付"),
    PAID("已支付"),
    COMPLETED("已完成"),
    REFUNDED("已退款"),
    CANCELLED("已取消");

    private final String description;
}
