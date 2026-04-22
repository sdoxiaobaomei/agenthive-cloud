package com.agenthive.logisticsservice.domain.vo;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class TrackVO {

    private Long id;
    private String trackingNo;
    private LocalDateTime eventTime;
    private String eventDesc;
    private String location;
}
