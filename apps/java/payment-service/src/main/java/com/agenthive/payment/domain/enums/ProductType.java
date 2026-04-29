package com.agenthive.payment.domain.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum ProductType {
    TEMPLATE("模板"),
    WEBSITE("成品网站"),
    COMPONENT("组件");

    private final String description;
}
