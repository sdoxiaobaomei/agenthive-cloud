package com.agenthive.payment.domain.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
@TableName("t_marketplace_product")
public class MarketplaceProduct {

    @TableId(type = IdType.AUTO)
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
