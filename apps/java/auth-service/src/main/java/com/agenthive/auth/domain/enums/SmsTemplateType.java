package com.agenthive.auth.domain.enums;

import lombok.Getter;

@Getter
public enum SmsTemplateType {

    LOGIN_REGISTER("100001", "登录/注册模板", 5),
    MODIFY_PHONE("100002", "修改绑定手机号模板", 5),
    RESET_PASSWORD("100003", "重置密码模板", 5),
    BIND_PHONE("100004", "绑定新手机号模板", 5),
    VERIFY_PHONE("100005", "验证绑定手机号模板", 5);

    private final String templateCode;
    private final String templateName;
    private final int defaultExpireMinutes;

    SmsTemplateType(String templateCode, String templateName, int defaultExpireMinutes) {
        this.templateCode = templateCode;
        this.templateName = templateName;
        this.defaultExpireMinutes = defaultExpireMinutes;
    }
}
