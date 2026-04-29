package com.agenthive.payment.service.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class ProductQueryRequest {

    private String category;

    private String tag;

    private BigDecimal minPrice;

    private BigDecimal maxPrice;

    private String sort = "createdAt_desc";

    private int page = 1;

    private int size = 20;
}
