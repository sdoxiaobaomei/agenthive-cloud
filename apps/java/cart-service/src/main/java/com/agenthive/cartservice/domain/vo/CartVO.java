package com.agenthive.cartservice.domain.vo;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class CartVO {

    private Long userId;
    private List<CartItemVO> items;
    private Integer totalCount;
    private Integer selectedCount;
    private BigDecimal totalPrice;
}
