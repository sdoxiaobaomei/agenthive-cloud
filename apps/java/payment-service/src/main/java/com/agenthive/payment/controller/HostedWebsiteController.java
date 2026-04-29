package com.agenthive.payment.controller;

import com.agenthive.payment.domain.vo.HostedWebsiteVO;
import com.agenthive.payment.domain.vo.TrafficStatsVO;
import com.agenthive.payment.internal.common.Result;
import com.agenthive.payment.service.HostedWebsiteService;
import com.agenthive.payment.service.dto.CreateHostedWebsiteRequest;
import com.agenthive.payment.service.dto.TrafficReportRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/hosted-websites")
@RequiredArgsConstructor
public class HostedWebsiteController {

    private final HostedWebsiteService hostedWebsiteService;

    @PostMapping
    public Result<HostedWebsiteVO> createHostedWebsite(@Valid @RequestBody CreateHostedWebsiteRequest request) {
        return Result.success(hostedWebsiteService.createHostedWebsite(request));
    }

    @GetMapping("/{id}")
    public Result<HostedWebsiteVO> getHostedWebsite(@PathVariable Long id) {
        return Result.success(hostedWebsiteService.getHostedWebsite(id));
    }

    @PatchMapping("/{id}/domain")
    public Result<HostedWebsiteVO> updateCustomDomain(@PathVariable Long id, @RequestParam String customDomain) {
        return Result.success(hostedWebsiteService.updateCustomDomain(id, customDomain));
    }

    @PostMapping("/{id}/deploy")
    public Result<HostedWebsiteVO> updateDeployConfig(@PathVariable Long id, @RequestBody String deployConfig) {
        return Result.success(hostedWebsiteService.updateDeployConfig(id, deployConfig));
    }

    @DeleteMapping("/{id}")
    public Result<Void> deleteHostedWebsite(@PathVariable Long id) {
        hostedWebsiteService.deleteHostedWebsite(id);
        return Result.success();
    }

    @PostMapping("/{id}/traffic")
    public Result<TrafficStatsVO> reportTraffic(@PathVariable Long id, @Valid @RequestBody TrafficReportRequest request) {
        request.setWebsiteId(id);
        return Result.success(hostedWebsiteService.reportTraffic(request));
    }
}
