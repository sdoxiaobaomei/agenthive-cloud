package com.agenthive.order.mapper;

import com.agenthive.order.domain.entity.CreatorEarning;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface CreatorEarningMapper extends BaseMapper<CreatorEarning> {

    @Select("SELECT * FROM t_creator_earning WHERE creator_id = #{creatorId} AND deleted = 0 ORDER BY created_at DESC")
    List<CreatorEarning> selectByCreatorId(@Param("creatorId") Long creatorId);

    @Select("SELECT * FROM t_creator_earning WHERE creator_id = #{creatorId} AND created_at >= #{start} AND created_at < #{end} AND deleted = 0 ORDER BY created_at DESC")
    List<CreatorEarning> selectByCreatorIdAndDateRange(@Param("creatorId") Long creatorId, @Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Select("SELECT COALESCE(SUM(net_earning), 0) FROM t_creator_earning WHERE creator_id = #{creatorId} AND created_at >= #{start} AND created_at < #{end} AND deleted = 0")
    java.math.BigDecimal sumNetEarningByDateRange(@Param("creatorId") Long creatorId, @Param("start") LocalDateTime start, @Param("end") LocalDateTime end);
}
