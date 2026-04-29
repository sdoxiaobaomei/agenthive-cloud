package com.agenthive.payment.domain.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum CreditsTransactionType {
    EARN_TRAFFIC("流量收益"),
    EARN_SALE("售卖收益"),
    RECHARGE("充值"),
    SPEND_AGENT("Agent 消耗"),
    WITHDRAW("提现"),
    FEE("手续费"),
    REFUND("退款");

    private final String description;
}
