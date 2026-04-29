package com.agenthive.payment.service;

import com.agenthive.payment.domain.entity.CreditsTransaction;
import com.agenthive.payment.domain.enums.CreditsTransactionType;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;

import java.math.BigDecimal;

public interface CreditsAccountService {

    BigDecimal getBalance(Long userId);

    void credit(Long userId, BigDecimal amount, CreditsTransactionType type, String sourceType, String sourceId, String description);

    void debit(Long userId, BigDecimal amount, CreditsTransactionType type, String sourceType, String sourceId, String description);

    Page<CreditsTransaction> getTransactions(Long userId, int page, int size);

    void freeze(Long userId, BigDecimal amount);

    void unfreeze(Long userId, BigDecimal amount);

    void deductFrozen(Long userId, BigDecimal amount);
}
