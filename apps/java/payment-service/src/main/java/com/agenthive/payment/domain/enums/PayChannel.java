package com.agenthive.payment.domain.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum PayChannel {
    CREDITS("平台代币"),
    FIAT("法币");

    private final String description;
}
