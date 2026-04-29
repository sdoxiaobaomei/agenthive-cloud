package com.agenthive.payment.mapper;

import com.agenthive.payment.domain.entity.TrafficRecord;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDate;

@Mapper
public interface TrafficRecordMapper extends BaseMapper<TrafficRecord> {

    @Select("SELECT * FROM t_traffic_record WHERE hosted_website_id = #{websiteId} AND date = #{date}")
    TrafficRecord selectByWebsiteAndDate(@Param("websiteId") Long websiteId, @Param("date") LocalDate date);
}
