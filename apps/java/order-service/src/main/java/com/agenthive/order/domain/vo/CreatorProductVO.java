package com.agenthive.order.domain.vo;

import com.agenthive.order.domain.enums.ProductStatus;
import com.agenthive.order.domain.enums.ProductType;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class CreatorProductVO {

    private Long id;
    private Long creatorId;
    private String name;
    private String description;
    private ProductType type;
    private List<String> techStackTags;
    private Integer creditsPrice;
    private BigDecimal fiatPrice;
    private List<String> previewImages;
    private String demoUrl;
    private Long sourceProjectId;
    private ProductStatus status;
    private Integer salesCount;
    private BigDecimal totalRevenue;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
