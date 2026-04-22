package com.agenthive.order.service.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class OrderItemRequest {
    @NotNull(message = "商品ID不能为空")
    private Long productId;
    @NotBlank(message = "商品名称不能为空")
    private String productName;
    private Long skuId;
    @NotNull(message = "数量不能为空")
    @Min(value = 1, message = "数量至少为1")
    private Integer quantity;
    @NotNull(message = "单价不能为空")
    private BigDecimal unitPrice;
}
