package com.agenthive.auth.domain.enums;

import lombok.Getter;

@Getter
public enum SmsTemplateType {

    LOGIN_REGISTER("LOGIN_REGISTER", "登录/注册模板", 5),
    MODIFY_PHONE("MODIFY_PHONE", "修改绑定手机号模板", 5),
    RESET_PASSWORD("RESET_PASSWORD", "重置密码模板", 5),
    BIND_PHONE("BIND_PHONE", "绑定新手机号模板", 5),
    VERIFY_PHONE("VERIFY_PHONE", "验证绑定手机号模板", 5);

    /** 模板标识（用于从 SmsProperties 读取对应 TemplateCode） */
    private final String templateKey;
    private final String templateName;
    private final int defaultExpireMinutes;

    SmsTemplateType(String templateKey, String templateName, int defaultExpireMinutes) {
        this.templateKey = templateKey;
        this.templateName = templateName;
        this.defaultExpireMinutes = defaultExpireMinutes;
    }
}
