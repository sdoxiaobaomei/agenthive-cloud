package com.agenthive.payment.controller;

import com.agenthive.payment.domain.vo.AgentPricingVO;
import com.agenthive.payment.domain.vo.AgentUsageVO;
import com.agenthive.payment.internal.common.Result;
import com.agenthive.payment.service.CreditsAgentService;
import com.agenthive.payment.service.dto.AgentDebitRequest;
import com.agenthive.payment.service.dto.AgentDebitResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/credits")
@RequiredArgsConstructor
public class CreditsAgentController {

    private final CreditsAgentService creditsAgentService;

    @PostMapping("/agent-debit")
    public Result<AgentDebitResponse> agentDebit(
            @Valid @RequestBody AgentDebitRequest request,
            @RequestHeader(value = "X-Internal-Token", required = false) String internalToken) {
        return Result.success(creditsAgentService.debit(request, internalToken));
    }

    @GetMapping("/agent-pricing")
    public Result<List<AgentPricingVO>> getPricingList() {
        return Result.success(creditsAgentService.getPricingList());
    }

    @GetMapping("/agent-usage/{userId}")
    public Result<AgentUsageVO> getUsageStats(@PathVariable Long userId) {
        return Result.success(creditsAgentService.getUsageStats(userId));
    }
}
