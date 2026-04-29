package com.agenthive.payment.service.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class CreateProductRequest {

    @NotNull
    private Long sellerId;

    @NotBlank
    private String type;

    @NotBlank
    private String name;

    private String description;

    private BigDecimal price;

    private BigDecimal creditsPrice;

    private String category;

    private String tags;

    private String previewImages;

    private String demoUrl;
}
