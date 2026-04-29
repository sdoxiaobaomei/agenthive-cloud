package com.agenthive.order.service.dto;

import com.agenthive.order.domain.enums.ProductStatus;
import com.agenthive.order.domain.enums.ProductType;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class UpdateProductRequest {

    private String name;
    private String description;
    private ProductType type;
    private List<String> techStackTags;
    private Integer creditsPrice;
    private BigDecimal fiatPrice;
    private List<String> previewImages;
    private String demoUrl;
    private ProductStatus status;
}
