package com.agenthive.logisticsservice.domain.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("t_logistics_track")
public class LogisticsTrack {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String trackingNo;
    private LocalDateTime eventTime;
    private String eventDesc;
    private String location;
}
