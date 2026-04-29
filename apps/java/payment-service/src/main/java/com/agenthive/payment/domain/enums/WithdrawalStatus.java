package com.agenthive.payment.domain.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum WithdrawalStatus {
    PENDING("待审批"),
    APPROVED("已审批"),
    REJECTED("已拒绝"),
    PROCESSING("打款中"),
    COMPLETED("已完成"),
    FAILED("打款失败");

    private final String description;
}
