package com.agenthive.payment.config;

import com.agenthive.payment.domain.entity.AgentQuotaConfig;
import com.agenthive.payment.domain.enums.PricingType;
import com.agenthive.payment.mapper.AgentQuotaConfigMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Slf4j
@Component
@RequiredArgsConstructor
public class AgentQuotaConfigInitializer implements CommandLineRunner {

    private final AgentQuotaConfigMapper agentQuotaConfigMapper;

    @Override
    public void run(String... args) {
        initConfig("frontend-dev", PricingType.PER_TASK, new BigDecimal("10.0000"), null);
        initConfig("backend-dev", PricingType.PER_TASK, new BigDecimal("15.0000"), null);
        initConfig("qa-engineer", PricingType.PER_TASK, new BigDecimal("5.0000"), null);
    }

    private void initConfig(String workerRole, PricingType pricingType, BigDecimal unitPrice, BigDecimal tokenPrice) {
        long count = agentQuotaConfigMapper.selectCount(
                new LambdaQueryWrapper<AgentQuotaConfig>()
                        .eq(AgentQuotaConfig::getWorkerRole, workerRole));
        if (count == 0) {
            AgentQuotaConfig config = new AgentQuotaConfig();
            config.setWorkerRole(workerRole);
            config.setPricingType(pricingType.name());
            config.setUnitPrice(unitPrice);
            config.setTokenPrice(tokenPrice);
            config.setCurrency("CREDITS");
            config.setIsActive(true);
            config.setCreatedAt(LocalDateTime.now());
            config.setUpdatedAt(LocalDateTime.now());
            agentQuotaConfigMapper.insert(config);
            log.info("Initialized agent quota config: workerRole={}, pricingType={}, unitPrice={}",
                    workerRole, pricingType, unitPrice);
        }
    }
}
