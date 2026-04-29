package com.agenthive.payment.domain.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@TableName("t_marketplace_purchase")
public class MarketplacePurchase {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long buyerId;

    private Long productId;

    private Long orderId;

    private LocalDateTime purchasedAt;
}
