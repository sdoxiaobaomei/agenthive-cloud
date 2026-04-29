package com.agenthive.payment.mapper;

import com.agenthive.payment.domain.entity.MarketplacePurchase;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface MarketplacePurchaseMapper extends BaseMapper<MarketplacePurchase> {

    @Select("SELECT COUNT(*) FROM t_marketplace_purchase WHERE buyer_id = #{buyerId} AND product_id = #{productId}")
    int countByBuyerAndProduct(@Param("buyerId") Long buyerId, @Param("productId") Long productId);
}
