package com.agenthive.payment.controller;

import com.agenthive.payment.domain.entity.CreditsTransaction;
import com.agenthive.payment.domain.enums.CreditsTransactionType;
import com.agenthive.payment.domain.vo.CreditsBalanceVO;
import com.agenthive.payment.internal.common.Result;
import com.agenthive.payment.service.CreditsAccountService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;

@RestController
@RequestMapping("/credits")
@RequiredArgsConstructor
public class CreditsController {

    private final CreditsAccountService creditsAccountService;

    @GetMapping("/balance/{userId}")
    public Result<CreditsBalanceVO> getBalance(@PathVariable Long userId) {
        BigDecimal balance = creditsAccountService.getBalance(userId);
        // TODO: extend service to return full account info including frozenBalance
        CreditsBalanceVO vo = new CreditsBalanceVO();
        vo.setUserId(userId);
        vo.setBalance(balance);
        return Result.success(vo);
    }

    @GetMapping("/transactions/{userId}")
    public Result<Page<CreditsTransaction>> getTransactions(
            @PathVariable Long userId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return Result.success(creditsAccountService.getTransactions(userId, page, size));
    }

    @PostMapping("/credit")
    public Result<Void> credit(@Valid @RequestBody CreditRequest request) {
        creditsAccountService.credit(request.getUserId(), request.getAmount(),
                request.getType(), request.getSourceType(), request.getSourceId(), request.getDescription());
        return Result.success();
    }

    @PostMapping("/debit")
    public Result<Void> debit(@Valid @RequestBody DebitRequest request) {
        creditsAccountService.debit(request.getUserId(), request.getAmount(),
                request.getType(), request.getSourceType(), request.getSourceId(), request.getDescription());
        return Result.success();
    }

    @Getter
    @Setter
    public static class CreditRequest {
        @NotNull private Long userId;
        @NotNull @DecimalMin("0.0001") private BigDecimal amount;
        @NotNull private CreditsTransactionType type;
        private String sourceType;
        private String sourceId;
        private String description;
    }

    @Getter
    @Setter
    public static class DebitRequest {
        @NotNull private Long userId;
        @NotNull @DecimalMin("0.0001") private BigDecimal amount;
        @NotNull private CreditsTransactionType type;
        private String sourceType;
        private String sourceId;
        private String description;
    }
}
