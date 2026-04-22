package com.agenthive.auth.domain.enums;

import lombok.Getter;

@Getter
public enum SmsSignature {

    YUNZHU_PLATFORM("云渚科技验证平台"),
    YUNZHU_SERVICE("云渚科技验证服务"),
    SUTONG_CODE("速通互联验证码"),
    SUTONG_PLATFORM("速通互联验证平台"),
    SUTONG_SERVICE("速通互联验证服务");

    private final String signName;

    SmsSignature(String signName) {
        this.signName = signName;
    }
}
