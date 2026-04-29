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
@TableName("t_marketplace_order")
public class MarketplaceOrder {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String orderNo;

    private Long buyerId;

    private Long sellerId;

    private Long productId;

    private String productType;

    private String productName;

    private BigDecimal price;

    private BigDecimal platformFee;

    private BigDecimal sellerEarn;

    private String status;

    private String payChannel;

    private LocalDateTime createdAt;

    private LocalDateTime completedAt;
}
