package com.agenthive.order.service.dto;

import com.agenthive.order.domain.enums.ProductType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class PublishProductRequest {

    @NotBlank(message = "商品名称不能为空")
    private String name;

    private String description;

    @NotNull(message = "商品类型不能为空")
    private ProductType type;

    private List<String> techStackTags;

    @NotNull(message = "Credits 价格不能为空")
    @Min(value = 1, message = "Credits 价格必须大于 0")
    private Integer creditsPrice;

    private BigDecimal fiatPrice;

    private List<String> previewImages;

    private String demoUrl;

    private Long sourceProjectId;
}
