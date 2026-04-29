package com.agenthive.payment.controller;

import com.agenthive.payment.domain.vo.WithdrawalVO;
import com.agenthive.payment.internal.common.Result;
import com.agenthive.payment.service.WithdrawalService;
import com.agenthive.payment.service.dto.ApplyWithdrawalRequest;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/credits/withdrawals")
@RequiredArgsConstructor
public class WithdrawalController {

    private final WithdrawalService withdrawalService;

    @PostMapping
    public Result<WithdrawalVO> apply(@Valid @RequestBody ApplyWithdrawalRequest request) {
        return Result.success(withdrawalService.applyWithdrawal(request));
    }

    @GetMapping
    public Result<Page<WithdrawalVO>> list(
            @RequestParam Long userId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return Result.success(withdrawalService.getWithdrawalList(userId, page, size));
    }

    @GetMapping("/{id}")
    public Result<WithdrawalVO> detail(@PathVariable Long id) {
        return Result.success(withdrawalService.getWithdrawalDetail(id));
    }
}
