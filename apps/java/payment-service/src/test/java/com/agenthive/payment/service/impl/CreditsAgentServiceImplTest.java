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
import com.agenthive.payment.service.dto.AgentDebitRequest;
import com.agenthive.payment.service.dto.AgentDebitResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CreditsAgentServiceImplTest {

    @Mock
    private InternalApiConfig internalApiConfig;

    @Mock
    private AgentQuotaConfigMapper agentQuotaConfigMapper;

    @Mock
    private CreditsAccountService creditsAccountService;

    @Mock
    private CreditsTransactionMapper creditsTransactionMapper;

    @InjectMocks
    private CreditsAgentServiceImpl creditsAgentService;

    private AgentQuotaConfig perTaskConfig;
    private AgentQuotaConfig perTokenConfig;

    @BeforeEach
    void setUp() {
        perTaskConfig = new AgentQuotaConfig();
        perTaskConfig.setId(1L);
        perTaskConfig.setWorkerRole("frontend-dev");
        perTaskConfig.setPricingType(PricingType.PER_TASK.name());
        perTaskConfig.setUnitPrice(new BigDecimal("10.0000"));
        perTaskConfig.setTokenPrice(null);
        perTaskConfig.setCurrency("CREDITS");
        perTaskConfig.setIsActive(true);

        perTokenConfig = new AgentQuotaConfig();
        perTokenConfig.setId(2L);
        perTokenConfig.setWorkerRole("backend-dev");
        perTokenConfig.setPricingType(PricingType.PER_TOKEN.name());
        perTokenConfig.setUnitPrice(null);
        perTokenConfig.setTokenPrice(new BigDecimal("0.0100"));
        perTokenConfig.setCurrency("CREDITS");
        perTokenConfig.setIsActive(true);
    }

    @Test
    void debit_perTask_success() {
        when(internalApiConfig.validate("valid-token")).thenReturn(true);
        when(creditsTransactionMapper.countBySource(100L, "AGENT_TASK", "TASK-001")).thenReturn(0);
        when(agentQuotaConfigMapper.selectOne(any())).thenReturn(perTaskConfig);
        when(creditsAccountService.getBalance(100L)).thenReturn(new BigDecimal("100.0000"));

        AgentDebitRequest request = new AgentDebitRequest();
        request.setUserId(100L);
        request.setTaskId("TASK-001");
        request.setWorkerRole("frontend-dev");

        AgentDebitResponse response = creditsAgentService.debit(request, "valid-token");

        assertTrue(response.isSuccess());
        assertEquals(new BigDecimal("10.0000"), response.getCreditsDeducted());
        verify(creditsAccountService).debit(eq(100L), eq(new BigDecimal("10.0000")),
                eq(CreditsTransactionType.SPEND_AGENT), eq("AGENT_TASK"), eq("TASK-001"), anyString());
    }

    @Test
    void debit_perToken_success() {
        when(internalApiConfig.validate("valid-token")).thenReturn(true);
        when(creditsTransactionMapper.countBySource(100L, "AGENT_TASK", "TASK-002")).thenReturn(0);
        when(agentQuotaConfigMapper.selectOne(any())).thenReturn(perTokenConfig);
        when(creditsAccountService.getBalance(100L)).thenReturn(new BigDecimal("100.0000"));

        AgentDebitRequest request = new AgentDebitRequest();
        request.setUserId(100L);
        request.setTaskId("TASK-002");
        request.setWorkerRole("backend-dev");
        request.setTokensUsed(new BigDecimal("500"));

        AgentDebitResponse response = creditsAgentService.debit(request, "valid-token");

        assertTrue(response.isSuccess());
        assertEquals(new BigDecimal("5.0000"), response.getCreditsDeducted()); // 500 * 0.01
    }

    @Test
    void debit_invalidToken_throwsException() {
        when(internalApiConfig.validate("bad-token")).thenReturn(false);

        AgentDebitRequest request = new AgentDebitRequest();
        request.setUserId(100L);
        request.setTaskId("TASK-003");
        request.setWorkerRole("frontend-dev");

        BusinessException ex = assertThrows(BusinessException.class, () ->
                creditsAgentService.debit(request, "bad-token"));
        assertEquals(403, ex.getCode());
    }

    @Test
    void debit_duplicateTaskId_returnsSuccessWithoutDeduction() {
        when(internalApiConfig.validate("valid-token")).thenReturn(true);
        when(creditsTransactionMapper.countBySource(100L, "AGENT_TASK", "TASK-001")).thenReturn(1);
        when(creditsAccountService.getBalance(100L)).thenReturn(new BigDecimal("90.0000"));

        AgentDebitRequest request = new AgentDebitRequest();
        request.setUserId(100L);
        request.setTaskId("TASK-001");
        request.setWorkerRole("frontend-dev");

        AgentDebitResponse response = creditsAgentService.debit(request, "valid-token");

        assertTrue(response.isSuccess());
        assertEquals(BigDecimal.ZERO, response.getCreditsDeducted());
        assertEquals(new BigDecimal("90.0000"), response.getCreditsRemaining());
        verify(creditsAccountService, never()).debit(any(), any(), any(), any(), any(), any());
    }

    @Test
    void debit_insufficientCredits_returnsErrorCode() {
        when(internalApiConfig.validate("valid-token")).thenReturn(true);
        when(creditsTransactionMapper.countBySource(100L, "AGENT_TASK", "TASK-004")).thenReturn(0);
        when(agentQuotaConfigMapper.selectOne(any())).thenReturn(perTaskConfig);
        when(creditsAccountService.getBalance(100L)).thenReturn(new BigDecimal("5.0000"));

        AgentDebitRequest request = new AgentDebitRequest();
        request.setUserId(100L);
        request.setTaskId("TASK-004");
        request.setWorkerRole("frontend-dev");

        AgentDebitResponse response = creditsAgentService.debit(request, "valid-token");

        assertFalse(response.isSuccess());
        assertEquals("INSUFFICIENT_CREDITS", response.getErrorCode());
        verify(creditsAccountService, never()).debit(any(), any(), any(), any(), any(), any());
    }

    @Test
    void debit_noPricingConfig_throwsException() {
        when(internalApiConfig.validate("valid-token")).thenReturn(true);
        when(creditsTransactionMapper.countBySource(100L, "AGENT_TASK", "TASK-005")).thenReturn(0);
        when(agentQuotaConfigMapper.selectOne(any())).thenReturn(null);

        AgentDebitRequest request = new AgentDebitRequest();
        request.setUserId(100L);
        request.setTaskId("TASK-005");
        request.setWorkerRole("unknown-role");

        BusinessException ex = assertThrows(BusinessException.class, () ->
                creditsAgentService.debit(request, "valid-token"));
        assertEquals(400, ex.getCode());
    }

    @Test
    void debit_perToken_missingTokensUsed_throwsException() {
        when(internalApiConfig.validate("valid-token")).thenReturn(true);
        when(creditsTransactionMapper.countBySource(100L, "AGENT_TASK", "TASK-006")).thenReturn(0);
        when(agentQuotaConfigMapper.selectOne(any())).thenReturn(perTokenConfig);

        AgentDebitRequest request = new AgentDebitRequest();
        request.setUserId(100L);
        request.setTaskId("TASK-006");
        request.setWorkerRole("backend-dev");

        BusinessException ex = assertThrows(BusinessException.class, () ->
                creditsAgentService.debit(request, "valid-token"));
        assertEquals(400, ex.getCode());
    }

    @Test
    void getPricingList_returnsActiveConfigs() {
        when(agentQuotaConfigMapper.selectList(any())).thenReturn(List.of(perTaskConfig, perTokenConfig));

        List<AgentPricingVO> result = creditsAgentService.getPricingList();

        assertEquals(2, result.size());
        assertEquals("frontend-dev", result.get(0).getWorkerRole());
        assertEquals("backend-dev", result.get(1).getWorkerRole());
    }

    @Test
    void getUsageStats_returnsCorrectStats() {
        when(creditsAccountService.getBalance(100L)).thenReturn(new BigDecimal("50.0000"));

        CreditsTransaction t1 = new CreditsTransaction();
        t1.setAmount(new BigDecimal("-10.0000"));
        CreditsTransaction t2 = new CreditsTransaction();
        t2.setAmount(new BigDecimal("-5.0000"));

        when(creditsTransactionMapper.selectList(any())).thenReturn(List.of(t1, t2));

        AgentUsageVO vo = creditsAgentService.getUsageStats(100L);

        assertEquals(new BigDecimal("50.0000"), vo.getCreditsRemaining());
        assertEquals(new BigDecimal("15.0000"), vo.getCreditsUsedTotal());
    }
}
