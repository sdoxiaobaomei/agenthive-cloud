package com.agenthive.logisticsservice.mapper;

import com.agenthive.logisticsservice.domain.entity.LogisticsTrack;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface LogisticsTrackMapper extends BaseMapper<LogisticsTrack> {

    @Select("SELECT * FROM t_logistics_track WHERE tracking_no = #{trackingNo} ORDER BY event_time DESC")
    List<LogisticsTrack> selectByTrackingNo(@Param("trackingNo") String trackingNo);
}
