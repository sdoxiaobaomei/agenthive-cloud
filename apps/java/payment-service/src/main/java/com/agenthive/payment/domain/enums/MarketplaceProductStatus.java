package com.agenthive.payment.domain.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum MarketplaceProductStatus {
    PENDING("待审核"),
    ACTIVE("上架中"),
    INACTIVE("已下架");

    private final String description;
}
