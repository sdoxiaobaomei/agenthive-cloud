package com.agenthive.payment.mapper;

import com.agenthive.payment.domain.entity.TrafficConversionConfig;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface TrafficConversionConfigMapper extends BaseMapper<TrafficConversionConfig> {

    @Select("SELECT * FROM t_traffic_conversion_config WHERE is_active = true")
    List<TrafficConversionConfig> selectActiveConfigs();

    @Select("SELECT * FROM t_traffic_conversion_config WHERE metric_type = #{metricType} AND is_active = true")
    TrafficConversionConfig selectByMetricType(@Param("metricType") String metricType);
}
