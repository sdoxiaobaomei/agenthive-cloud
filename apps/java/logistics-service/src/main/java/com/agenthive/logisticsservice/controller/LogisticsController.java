package com.agenthive.logisticsservice.controller;

import com.agenthive.logisticsservice.domain.dto.CreateLogisticsRequest;
import com.agenthive.logisticsservice.domain.vo.LogisticsVO;
import com.agenthive.logisticsservice.domain.vo.TrackVO;
import com.agenthive.logisticsservice.internal.common.Result;
import com.agenthive.logisticsservice.service.LogisticsService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/logistics")
@RequiredArgsConstructor
public class LogisticsController {

    private final LogisticsService logisticsService;

    @PostMapping("/create")
    public Result<LogisticsVO> createLogistics(@Valid @RequestBody CreateLogisticsRequest request) {
        return Result.success(logisticsService.createLogistics(request));
    }

    @GetMapping("/{orderNo}")
    public Result<LogisticsVO> getByOrderNo(@PathVariable String orderNo) {
        return Result.success(logisticsService.getByOrderNo(orderNo));
    }

    @GetMapping("/{trackingNo}/tracks")
    public Result<List<TrackVO>> getTracks(@PathVariable String trackingNo) {
        return Result.success(logisticsService.getTracks(trackingNo));
    }

    @PutMapping("/{trackingNo}/ship")
    public Result<Void> ship(@PathVariable String trackingNo) {
        logisticsService.ship(trackingNo);
        return Result.success();
    }

    @PutMapping("/{trackingNo}/deliver")
    public Result<Void> deliver(@PathVariable String trackingNo) {
        logisticsService.deliver(trackingNo);
        return Result.success();
    }
}
