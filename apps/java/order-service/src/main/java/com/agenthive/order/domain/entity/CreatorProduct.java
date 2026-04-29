package com.agenthive.order.domain.entity;

import com.agenthive.common.mybatis.entity.BaseEntity;
import com.agenthive.order.domain.enums.ProductStatus;
import com.agenthive.order.domain.enums.ProductType;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_creator_product")
public class CreatorProduct extends BaseEntity {

    private Long creatorId;
    private String name;
    private String description;
    private ProductType type;
    private String techStackTags;
    private Integer creditsPrice;
    private BigDecimal fiatPrice;
    private String previewImages;
    private String demoUrl;
    private Long sourceProjectId;
    private ProductStatus status;
    private Integer salesCount;
    private BigDecimal totalRevenue;
}
