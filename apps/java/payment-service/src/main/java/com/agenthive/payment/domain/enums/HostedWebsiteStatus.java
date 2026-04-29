package com.agenthive.payment.domain.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum HostedWebsiteStatus {
    ACTIVE("运行中"),
    DEPLOYING("部署中"),
    SUSPENDED("已暂停"),
    DELETED("已删除");

    private final String description;
}
