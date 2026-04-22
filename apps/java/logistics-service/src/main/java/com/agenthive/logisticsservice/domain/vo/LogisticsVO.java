package com.agenthive.logisticsservice.domain.vo;

import com.agenthive.logisticsservice.domain.enums.CarrierType;
import com.agenthive.logisticsservice.domain.enums.LogisticsStatus;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class LogisticsVO {

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
