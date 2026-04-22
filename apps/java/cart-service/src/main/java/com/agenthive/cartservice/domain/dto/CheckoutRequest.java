package com.agenthive.cartservice.domain.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class CheckoutRequest {

    @NotNull(message = "User ID is required")
    private Long userId;

    private List<Long> selectedItemIds;
}
