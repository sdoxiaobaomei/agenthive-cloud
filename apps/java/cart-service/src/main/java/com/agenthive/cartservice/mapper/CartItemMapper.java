package com.agenthive.cartservice.mapper;

import com.agenthive.cartservice.domain.entity.CartItem;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface CartItemMapper extends BaseMapper<CartItem> {

    @Select("SELECT * FROM t_cart_item WHERE user_id = #{userId} ORDER BY created_at DESC")
    List<CartItem> selectByUserId(@Param("userId") Long userId);

    @Select("SELECT * FROM t_cart_item WHERE user_id = #{userId} AND product_id = #{productId} AND (sku_id = #{skuId} OR (sku_id IS NULL AND #{skuId} IS NULL))")
    CartItem selectByUserAndSku(@Param("userId") Long userId, @Param("productId") Long productId, @Param("skuId") Long skuId);
}
