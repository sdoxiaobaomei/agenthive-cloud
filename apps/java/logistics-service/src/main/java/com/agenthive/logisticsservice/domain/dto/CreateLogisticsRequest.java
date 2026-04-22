package com.agenthive.logisticsservice.domain.dto;

import com.agenthive.logisticsservice.domain.enums.CarrierType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateLogisticsRequest {

    @NotBlank(message = "Order number is required")
    private String orderNo;

    @NotNull(message = "Carrier is required")
    private CarrierType carrier;

    private String senderInfo;
    private String receiverInfo;
}
