package com.agenthive.logisticsservice.mapper;

import com.agenthive.logisticsservice.domain.entity.Logistics;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface LogisticsMapper extends BaseMapper<Logistics> {

    @Select("SELECT * FROM t_logistics WHERE order_no = #{orderNo} LIMIT 1")
    Logistics selectByOrderNo(@Param("orderNo") String orderNo);

    @Select("SELECT * FROM t_logistics WHERE tracking_no = #{trackingNo} LIMIT 1")
    Logistics selectByTrackingNo(@Param("trackingNo") String trackingNo);
}
