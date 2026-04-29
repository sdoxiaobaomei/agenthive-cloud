package com.agenthive.payment.service.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreateOrderRequest {

    @NotNull
    private Long buyerId;

    @NotNull
    private Long productId;

    @NotNull
    private String payChannel;
}
