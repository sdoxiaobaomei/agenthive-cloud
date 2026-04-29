package com.agenthive.payment.service;

import com.agenthive.payment.domain.vo.HostedWebsiteVO;
import com.agenthive.payment.domain.vo.TrafficStatsVO;
import com.agenthive.payment.service.dto.CreateHostedWebsiteRequest;
import com.agenthive.payment.service.dto.TrafficReportRequest;

public interface HostedWebsiteService {

    HostedWebsiteVO createHostedWebsite(CreateHostedWebsiteRequest request);

    HostedWebsiteVO getHostedWebsite(Long id);

    HostedWebsiteVO updateCustomDomain(Long id, String customDomain);

    HostedWebsiteVO updateDeployConfig(Long id, String deployConfig);

    void deleteHostedWebsite(Long id);

    TrafficStatsVO reportTraffic(TrafficReportRequest request);
}
