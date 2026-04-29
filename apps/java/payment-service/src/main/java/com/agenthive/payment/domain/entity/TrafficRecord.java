package com.agenthive.payment.domain.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@TableName("t_traffic_record")
public class TrafficRecord {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long hostedWebsiteId;

    private LocalDate date;

    private Long pvCount;

    private Long uvCount;

    private BigDecimal creditsEarned;

    private Long version;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
