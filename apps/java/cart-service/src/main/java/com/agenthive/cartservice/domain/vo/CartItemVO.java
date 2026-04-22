package com.agenthive.cartservice.domain.vo;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class CartItemVO {

    private Long id;
    private Long userId;
    private Long productId;
    private Long skuId;
    private Integer quantity;
    private Boolean selected;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
