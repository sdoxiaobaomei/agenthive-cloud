package com.agenthive.logisticsservice.domain.entity;

import com.agenthive.logisticsservice.domain.enums.CarrierType;
import com.agenthive.logisticsservice.domain.enums.LogisticsStatus;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("t_logistics")
public class Logistics {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String orderNo;
    private String trackingNo;
    private CarrierType carrier;
    private LogisticsStatus status;
    private String senderInfo;
    private String receiverInfo;
    private LocalDateTime createdAt;
    private LocalDateTime shippedAt;
    private LocalDateTime deliveredAt;
}
