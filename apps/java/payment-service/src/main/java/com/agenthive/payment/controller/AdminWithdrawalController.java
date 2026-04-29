package com.agenthive.payment.controller;

import com.agenthive.payment.config.InternalApiConfig;
import com.agenthive.payment.domain.vo.WithdrawalVO;
import com.agenthive.payment.internal.common.BusinessException;
import com.agenthive.payment.internal.common.Result;
import com.agenthive.payment.service.WithdrawalService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/admin/withdrawals")
@RequiredArgsConstructor
public class AdminWithdrawalController {

    private final WithdrawalService withdrawalService;
    private final InternalApiConfig internalApiConfig;

    @GetMapping
    public Result<Page<WithdrawalVO>> list(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestHeader(value = "X-Internal-Token", required = false) String internalToken) {
        validateToken(internalToken);
        return Result.success(withdrawalService.getAdminWithdrawalList(status, page, size));
    }

    @PostMapping("/{id}/approve")
    public Result<WithdrawalVO> approve(
            @PathVariable Long id,
            @RequestParam Long adminId,
            @RequestHeader(value = "X-Internal-Token", required = false) String internalToken) {
        validateToken(internalToken);
        return Result.success(withdrawalService.approveWithdrawal(id, adminId));
    }

    @PostMapping("/{id}/reject")
    public Result<WithdrawalVO> reject(
            @PathVariable Long id,
            @RequestParam Long adminId,
            @RequestParam String rejectReason,
            @RequestHeader(value = "X-Internal-Token", required = false) String internalToken) {
        validateToken(internalToken);
        return Result.success(withdrawalService.rejectWithdrawal(id, adminId, rejectReason));
    }

    private void validateToken(String internalToken) {
        if (!internalApiConfig.validate(internalToken)) {
            throw new BusinessException(403, "Invalid internal token");
        }
    }
}
