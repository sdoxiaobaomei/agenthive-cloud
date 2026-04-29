package com.agenthive.order.mapper;

import com.agenthive.order.domain.entity.CreatorProduct;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

@Mapper
public interface CreatorProductMapper extends BaseMapper<CreatorProduct> {

    @Select("SELECT * FROM t_creator_product WHERE creator_id = #{creatorId} AND deleted = 0 ORDER BY created_at DESC")
    List<CreatorProduct> selectByCreatorId(@Param("creatorId") Long creatorId);

    @Select("SELECT * FROM t_creator_product WHERE creator_id = #{creatorId} AND status = #{status} AND deleted = 0 ORDER BY created_at DESC")
    List<CreatorProduct> selectByCreatorIdAndStatus(@Param("creatorId") Long creatorId, @Param("status") String status);

    @Update("UPDATE t_creator_product SET sales_count = sales_count + 1, total_revenue = total_revenue + #{amount} WHERE id = #{productId}")
    int incrementSales(@Param("productId") Long productId, @Param("amount") java.math.BigDecimal amount);
}
