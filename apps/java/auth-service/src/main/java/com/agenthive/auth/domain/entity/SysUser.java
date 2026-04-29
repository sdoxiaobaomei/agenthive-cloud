package com.agenthive.auth.domain.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.agenthive.common.mybatis.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

@Getter
@Setter
@ToString(callSuper = true, exclude = {"password"})
@EqualsAndHashCode(callSuper = true)
@TableName("sys_user")
public class SysUser extends BaseEntity {

    private String username;
    @JsonIgnore
    private String password;
    private String email;
    private String phone;
    private String avatar;
    private Integer status;
}
