package com.agenthive.payment.domain.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum PricingType {
    PER_TASK("按任务固定价"),
    PER_TOKEN("按 Token 数量");

    private final String description;
}
