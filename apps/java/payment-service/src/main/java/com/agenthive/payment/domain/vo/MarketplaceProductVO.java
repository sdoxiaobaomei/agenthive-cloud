package com.agenthive.payment.domain.vo;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
public class MarketplaceProductVO {

    private Long id;
    private Long sellerId;
    private String type;
    private String name;
    private String description;
    private BigDecimal price;
    private BigDecimal creditsPrice;
    private String category;
    private String tags;
    private String previewImages;
    private String demoUrl;
    private String status;
    private Integer salesCount;
    private BigDecimal rating;
    private Integer reviewCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
