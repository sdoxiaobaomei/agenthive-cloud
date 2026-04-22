package com.agenthive.payment.controller;

import com.agenthive.payment.domain.vo.WalletVO;
import com.agenthive.payment.internal.common.Result;
import com.agenthive.payment.service.WalletService;
import com.agenthive.payment.service.dto.RechargeRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/wallets")
@RequiredArgsConstructor
public class WalletController {

    private final WalletService walletService;

    @GetMapping("/{userId}")
    public Result<WalletVO> getWallet(@PathVariable Long userId) {
        return Result.success(walletService.getWallet(userId));
    }

    @PostMapping("/recharge")
    public Result<WalletVO> recharge(@Valid @RequestBody RechargeRequest request) {
        return Result.success(walletService.recharge(request));
    }
}
