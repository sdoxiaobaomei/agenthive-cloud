package com.agenthive.payment.service;

import com.agenthive.payment.domain.vo.AgentPricingVO;
import com.agenthive.payment.domain.vo.AgentUsageVO;
import com.agenthive.payment.service.dto.AgentDebitRequest;
import com.agenthive.payment.service.dto.AgentDebitResponse;

import java.util.List;

public interface CreditsAgentService {

    AgentDebitResponse debit(AgentDebitRequest request, String internalToken);

    List<AgentPricingVO> getPricingList();

    AgentUsageVO getUsageStats(Long userId);
}
