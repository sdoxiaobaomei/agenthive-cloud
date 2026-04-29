package com.agenthive.payment.service.impl;

import com.agenthive.payment.domain.entity.CreditsAccount;
import com.agenthive.payment.domain.entity.CreditsTransaction;
import com.agenthive.payment.domain.enums.CreditsTransactionType;
import com.agenthive.payment.internal.common.BusinessException;
import com.agenthive.payment.mapper.CreditsAccountMapper;
import com.agenthive.payment.mapper.CreditsTransactionMapper;
import com.agenthive.payment.service.CreditsAccountService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class CreditsAccountServiceImpl implements CreditsAccountService {

    private final CreditsAccountMapper creditsAccountMapper;
    private final CreditsTransactionMapper creditsTransactionMapper;

    @Override
    public BigDecimal getBalance(Long userId) {
        CreditsAccount account = creditsAccountMapper.selectOne(
                new LambdaQueryWrapper<CreditsAccount>().eq(CreditsAccount::getUserId, userId));
        if (account == null) {
            account = createAccount(userId);
        }
        return account.getBalance();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void credit(Long userId, BigDecimal amount, CreditsTransactionType type,
                       String sourceType, String sourceId, String description) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("入账金额必须大于 0");
        }

        // 幂等性检查
        if (sourceType != null && sourceId != null) {
            int count = creditsTransactionMapper.countBySource(userId, sourceType, sourceId);
            if (count > 0) {
                log.info("Credits credit skipped for duplicate source: userId={}, sourceType={}, sourceId={}",
                        userId, sourceType, sourceId);
                return;
            }
        }

        CreditsAccount account = creditsAccountMapper.selectOne(
                new LambdaQueryWrapper<CreditsAccount>().eq(CreditsAccount::getUserId, userId));
        if (account == null) {
            account = createAccount(userId);
        }

        int rows = creditsAccountMapper.addBalance(userId, amount, account.getVersion());
        if (rows == 0) {
            throw new BusinessException("入账失败，请重试");
        }

        // 重新查询获取最新余额
        account = creditsAccountMapper.selectOne(
                new LambdaQueryWrapper<CreditsAccount>().eq(CreditsAccount::getUserId, userId));

        CreditsTransaction transaction = new CreditsTransaction();
        transaction.setUserId(userId);
        transaction.setType(type.name());
        transaction.setAmount(amount);
        transaction.setBalanceAfter(account.getBalance());
        transaction.setSourceType(sourceType);
        transaction.setSourceId(sourceId);
        transaction.setDescription(description);
        transaction.setCreatedAt(LocalDateTime.now());
        creditsTransactionMapper.insert(transaction);

        log.info("Credits credited: userId={}, amount={}, type={}, balanceAfter={}",
                userId, amount, type, account.getBalance());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void debit(Long userId, BigDecimal amount, CreditsTransactionType type,
                      String sourceType, String sourceId, String description) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("出账金额必须大于 0");
        }

        CreditsAccount account = creditsAccountMapper.selectOne(
                new LambdaQueryWrapper<CreditsAccount>().eq(CreditsAccount::getUserId, userId));
        if (account == null) {
            throw new BusinessException("Credits 余额不足");
        }

        if (account.getBalance().compareTo(amount) < 0) {
            throw new BusinessException("Credits 余额不足");
        }

        int rows = creditsAccountMapper.deductBalance(userId, amount, account.getVersion());
        if (rows == 0) {
            throw new BusinessException("出账失败，请重试");
        }

        account = creditsAccountMapper.selectOne(
                new LambdaQueryWrapper<CreditsAccount>().eq(CreditsAccount::getUserId, userId));

        CreditsTransaction transaction = new CreditsTransaction();
        transaction.setUserId(userId);
        transaction.setType(type.name());
        transaction.setAmount(amount.negate());
        transaction.setBalanceAfter(account.getBalance());
        transaction.setSourceType(sourceType);
        transaction.setSourceId(sourceId);
        transaction.setDescription(description);
        transaction.setCreatedAt(LocalDateTime.now());
        creditsTransactionMapper.insert(transaction);

        log.info("Credits debited: userId={}, amount={}, type={}, balanceAfter={}",
                userId, amount, type, account.getBalance());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void freeze(Long userId, BigDecimal amount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("冻结金额必须大于 0");
        }
        CreditsAccount account = creditsAccountMapper.selectOne(
                new LambdaQueryWrapper<CreditsAccount>().eq(CreditsAccount::getUserId, userId));
        if (account == null || account.getBalance().compareTo(amount) < 0) {
            throw new BusinessException("Credits 余额不足");
        }
        int rows = creditsAccountMapper.freezeBalance(userId, amount, account.getVersion());
        if (rows == 0) {
            throw new BusinessException("冻结失败，请重试");
        }
        log.info("Credits frozen: userId={}, amount={}", userId, amount);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void unfreeze(Long userId, BigDecimal amount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("解冻金额必须大于 0");
        }
        CreditsAccount account = creditsAccountMapper.selectOne(
                new LambdaQueryWrapper<CreditsAccount>().eq(CreditsAccount::getUserId, userId));
        if (account == null || account.getFrozenBalance().compareTo(amount) < 0) {
            throw new BusinessException("冻结余额不足");
        }
        int rows = creditsAccountMapper.unfreezeBalance(userId, amount, account.getVersion());
        if (rows == 0) {
            throw new BusinessException("解冻失败，请重试");
        }
        log.info("Credits unfrozen: userId={}, amount={}", userId, amount);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deductFrozen(Long userId, BigDecimal amount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("扣减金额必须大于 0");
        }
        CreditsAccount account = creditsAccountMapper.selectOne(
                new LambdaQueryWrapper<CreditsAccount>().eq(CreditsAccount::getUserId, userId));
        if (account == null || account.getFrozenBalance().compareTo(amount) < 0) {
            throw new BusinessException("冻结余额不足");
        }
        int rows = creditsAccountMapper.deductFrozenBalance(userId, amount, account.getVersion());
        if (rows == 0) {
            throw new BusinessException("扣减失败，请重试");
        }
        log.info("Credits deducted from frozen: userId={}, amount={}", userId, amount);
    }

    @Override
    public Page<CreditsTransaction> getTransactions(Long userId, int page, int size) {
        LambdaQueryWrapper<CreditsTransaction> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(CreditsTransaction::getUserId, userId);
        wrapper.orderByDesc(CreditsTransaction::getCreatedAt);
        return creditsTransactionMapper.selectPage(new Page<>(page, size), wrapper);
    }

    private CreditsAccount createAccount(Long userId) {
        CreditsAccount account = new CreditsAccount();
        account.setUserId(userId);
        account.setBalance(BigDecimal.ZERO);
        account.setFrozenBalance(BigDecimal.ZERO);
        account.setTotalEarned(BigDecimal.ZERO);
        account.setTotalSpent(BigDecimal.ZERO);
        account.setTotalWithdrawn(BigDecimal.ZERO);
        account.setVersion(0L);
        account.setUpdatedAt(LocalDateTime.now());
        creditsAccountMapper.insert(account);
        log.info("Credits account initialized for userId={}", userId);
        return account;
    }
}
