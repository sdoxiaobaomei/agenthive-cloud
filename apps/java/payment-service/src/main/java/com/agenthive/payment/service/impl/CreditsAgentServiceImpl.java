package com.agenthive.payment.service.impl;

import com.agenthive.payment.config.InternalApiConfig;
import com.agenthive.payment.domain.entity.AgentQuotaConfig;
import com.agenthive.payment.domain.entity.CreditsTransaction;
import com.agenthive.payment.domain.enums.CreditsTransactionType;
import com.agenthive.payment.domain.enums.PricingType;
import com.agenthive.payment.domain.vo.AgentPricingVO;
import com.agenthive.payment.domain.vo.AgentUsageVO;
import com.agenthive.payment.internal.common.BusinessException;
import com.agenthive.payment.mapper.AgentQuotaConfigMapper;
import com.agenthive.payment.mapper.CreditsTransactionMapper;
import com.agenthive.payment.service.CreditsAccountService;
import com.agenthive.payment.service.CreditsAgentService;
import com.agenthive.payment.service.dto.AgentDebitRequest;
import com.agenthive.payment.service.dto.AgentDebitResponse;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class CreditsAgentServiceImpl implements CreditsAgentService {

    private final InternalApiConfig internalApiConfig;
    private final AgentQuotaConfigMapper agentQuotaConfigMapper;
    private final CreditsAccountService creditsAccountService;
    private final CreditsTransactionMapper creditsTransactionMapper;

    @Override
    @Transactional(rollbackFor = Exception.class, readOnly = true)
    public AgentDebitResponse debit(AgentDebitRequest request, String internalToken) {
        // 1. 鉴权校验
        if (!internalApiConfig.validate(internalToken)) {
            throw new BusinessException(403, "Unauthorized internal API access");
        }

        // 2. 幂等性检查
        int existingCount = creditsTransactionMapper.countBySource(
                request.getUserId(), "AGENT_TASK", request.getTaskId());
        if (existingCount > 0) {
            log.info("Agent debit skipped for duplicate taskId: userId={}, taskId={}",
                    request.getUserId(), request.getTaskId());
            BigDecimal balance = creditsAccountService.getBalance(request.getUserId());
            return AgentDebitResponse.builder()
                    .success(true)
                    .creditsDeducted(BigDecimal.ZERO)
                    .creditsRemaining(balance)
                    .build();
        }

        // 3. 查询定价配置
        AgentQuotaConfig config = agentQuotaConfigMapper.selectOne(
                new LambdaQueryWrapper<AgentQuotaConfig>()
                        .eq(AgentQuotaConfig::getWorkerRole, request.getWorkerRole())
                        .eq(AgentQuotaConfig::getIsActive, true));
        if (config == null) {
            log.warn("No active pricing config found for workerRole: {}", request.getWorkerRole());
            throw new BusinessException("未找到该角色的定价配置: " + request.getWorkerRole());
        }

        // 4. 计算费用
        BigDecimal cost;
        if (PricingType.PER_TASK.name().equals(config.getPricingType())) {
            cost = config.getUnitPrice();
        } else if (PricingType.PER_TOKEN.name().equals(config.getPricingType())) {
            if (request.getTokensUsed() == null || request.getTokensUsed().compareTo(BigDecimal.ZERO) <= 0) {
                throw new BusinessException("PER_TOKEN 定价模式需要提供有效的 tokensUsed");
            }
            cost = request.getTokensUsed().multiply(config.getTokenPrice());
        } else {
            throw new BusinessException("未知的定价类型: " + config.getPricingType());
        }

        // 5. 余额检查（提前检查，避免事务内异常）
        BigDecimal balance = creditsAccountService.getBalance(request.getUserId());
        if (balance.compareTo(cost) < 0) {
            log.warn("Insufficient credits: userId={}, required={}, balance={}",
                    request.getUserId(), cost, balance);
            return AgentDebitResponse.builder()
                    .success(false)
                    .creditsDeducted(BigDecimal.ZERO)
                    .creditsRemaining(balance)
                    .errorCode("INSUFFICIENT_CREDITS")
                    .build();
        }

        // 6. 扣费
        try {
            creditsAccountService.debit(request.getUserId(), cost,
                    CreditsTransactionType.SPEND_AGENT, "AGENT_TASK", request.getTaskId(),
                    String.format("Agent task: %s, role: %s", request.getTaskId(), request.getWorkerRole()));
        } catch (BusinessException e) {
            if (e.getMessage().contains("余额不足")) {
                return AgentDebitResponse.builder()
                        .success(false)
                        .creditsDeducted(BigDecimal.ZERO)
                        .creditsRemaining(balance)
                        .errorCode("INSUFFICIENT_CREDITS")
                        .build();
            }
            throw e;
        }

        BigDecimal remaining = creditsAccountService.getBalance(request.getUserId());
        log.info("Agent debited: userId={}, taskId={}, workerRole={}, cost={}, remaining={}",
                request.getUserId(), request.getTaskId(), request.getWorkerRole(), cost, remaining);

        return AgentDebitResponse.builder()
                .success(true)
                .creditsDeducted(cost)
                .creditsRemaining(remaining)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<AgentPricingVO> getPricingList() {
        List<AgentQuotaConfig> configs = agentQuotaConfigMapper.selectList(
                new LambdaQueryWrapper<AgentQuotaConfig>()
                        .eq(AgentQuotaConfig::getIsActive, true)
                        .orderByAsc(AgentQuotaConfig::getWorkerRole));

        return configs.stream().map(config -> {
            AgentPricingVO vo = new AgentPricingVO();
            vo.setWorkerRole(config.getWorkerRole());
            vo.setPricingType(config.getPricingType());
            vo.setUnitPrice(config.getUnitPrice());
            vo.setTokenPrice(config.getTokenPrice());
            vo.setCurrency(config.getCurrency());
            return vo;
        }).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public AgentUsageVO getUsageStats(Long userId) {
        BigDecimal remaining = creditsAccountService.getBalance(userId);

        // 本月消耗（SPEND_AGENT 类型，本月）
        LocalDateTime startOfMonth = LocalDateTime.of(LocalDate.now().withDayOfMonth(1), LocalTime.MIN);
        LambdaQueryWrapper<CreditsTransaction> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(CreditsTransaction::getUserId, userId)
                .eq(CreditsTransaction::getType, CreditsTransactionType.SPEND_AGENT.name())
                .ge(CreditsTransaction::getCreatedAt, startOfMonth);
        List<CreditsTransaction> thisMonthTxns = creditsTransactionMapper.selectList(wrapper);
        BigDecimal usedThisMonth = thisMonthTxns.stream()
                .map(CreditsTransaction::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .abs();

        // 历史总消耗
        LambdaQueryWrapper<CreditsTransaction> totalWrapper = new LambdaQueryWrapper<>();
        totalWrapper.eq(CreditsTransaction::getUserId, userId)
                .eq(CreditsTransaction::getType, CreditsTransactionType.SPEND_AGENT.name());
        List<CreditsTransaction> totalTxns = creditsTransactionMapper.selectList(totalWrapper);
        BigDecimal usedTotal = totalTxns.stream()
                .map(CreditsTransaction::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .abs();

        AgentUsageVO vo = new AgentUsageVO();
        vo.setUserId(userId);
        vo.setCreditsRemaining(remaining);
        vo.setCreditsUsedThisMonth(usedThisMonth);
        vo.setCreditsUsedTotal(usedTotal);
        return vo;
    }
}
