package com.agenthive.payment.job;

import com.agenthive.payment.service.TrafficSettlementService;
import com.agenthive.payment.service.dto.SettlementReport;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

@Slf4j
@Component
@RequiredArgsConstructor
public class TrafficSettlementJob {

    private final TrafficSettlementService trafficSettlementService;

    @Scheduled(cron = "0 0 2 * * ?")
    public void settleDailyTraffic() {
        LocalDate yesterday = LocalDate.now().minusDays(1);
        log.info("TrafficSettlementJob triggered for date={}", yesterday);

        SettlementReport report = trafficSettlementService.settleTrafficForDate(yesterday);

        log.info("TrafficSettlementJob finished: date={}, settledWebsites={}, failedWebsites={}, totalPv={}, totalUv={}, totalCredits={}",
                yesterday, report.getSettledWebsites(), report.getFailedWebsites(),
                report.getTotalPv(), report.getTotalUv(), report.getTotalCredits());
    }
}
