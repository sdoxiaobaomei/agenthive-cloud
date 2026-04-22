package com.agenthive.logisticsservice.service;

import com.agenthive.logisticsservice.domain.dto.CreateLogisticsRequest;
import com.agenthive.logisticsservice.domain.vo.LogisticsVO;
import com.agenthive.logisticsservice.domain.vo.TrackVO;

import java.util.List;

public interface LogisticsService {

    LogisticsVO createLogistics(CreateLogisticsRequest request);

    LogisticsVO getByOrderNo(String orderNo);

    List<TrackVO> getTracks(String trackingNo);

    void ship(String trackingNo);

    void deliver(String trackingNo);

    LogisticsVO autoCreateForOrder(String orderNo);
}
