package com.agenthive.payment.service.impl;

import com.agenthive.payment.domain.entity.CreditsAccount;
import com.agenthive.payment.domain.entity.CreditsTransaction;
import com.agenthive.payment.domain.enums.CreditsTransactionType;
import com.agenthive.payment.internal.common.BusinessException;
import com.agenthive.payment.mapper.CreditsAccountMapper;
import com.agenthive.payment.mapper.CreditsTransactionMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CreditsAccountServiceImplTest {

    @Mock
    private CreditsAccountMapper creditsAccountMapper;

    @Mock
    private CreditsTransactionMapper creditsTransactionMapper;

    @InjectMocks
    private CreditsAccountServiceImpl creditsAccountService;

    private CreditsAccount account;

    @BeforeEach
    void setUp() {
        account = new CreditsAccount();
        account.setId(1L);
        account.setUserId(100L);
        account.setBalance(new BigDecimal("100.0000"));
        account.setTotalEarned(new BigDecimal("200.0000"));
        account.setTotalSpent(new BigDecimal("50.0000"));
        account.setTotalWithdrawn(new BigDecimal("50.0000"));
        account.setVersion(5L);
    }

    @Test
    void getBalance_existingAccount_returnsBalance() {
        when(creditsAccountMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(account);
        BigDecimal balance = creditsAccountService.getBalance(100L);
        assertEquals(new BigDecimal("100.0000"), balance);
    }

    @Test
    void getBalance_newAccount_createsAndReturnsZero() {
        when(creditsAccountMapper.selectOne(any(LambdaQueryWrapper.class)))
                .thenReturn(null)
                .thenReturn(account);
        when(creditsAccountMapper.insert(any(CreditsAccount.class))).thenReturn(1);

        BigDecimal balance = creditsAccountService.getBalance(101L);
        assertEquals(BigDecimal.ZERO, balance);

        ArgumentCaptor<CreditsAccount> captor = ArgumentCaptor.forClass(CreditsAccount.class);
        verify(creditsAccountMapper).insert(captor.capture());
        assertEquals(101L, captor.getValue().getUserId());
        assertEquals(BigDecimal.ZERO, captor.getValue().getBalance());
    }

    @Test
    void credit_success_addsBalanceAndCreatesTransaction() {
        when(creditsAccountMapper.selectOne(any(LambdaQueryWrapper.class)))
                .thenReturn(account)
                .thenReturn(account);
        when(creditsTransactionMapper.countBySource(100L, "ORDER", "ORD-001")).thenReturn(0);
        when(creditsAccountMapper.addBalance(100L, new BigDecimal("10.0000"), 5L)).thenReturn(1);

        creditsAccountService.credit(100L, new BigDecimal("10.0000"),
                CreditsTransactionType.EARN_SALE, "ORDER", "ORD-001", "测试入账");

        verify(creditsAccountMapper).addBalance(100L, new BigDecimal("10.0000"), 5L);
        ArgumentCaptor<CreditsTransaction> txCaptor = ArgumentCaptor.forClass(CreditsTransaction.class);
        verify(creditsTransactionMapper).insert(txCaptor.capture());
        assertEquals(CreditsTransactionType.EARN_SALE.name(), txCaptor.getValue().getType());
        assertEquals(new BigDecimal("10.0000"), txCaptor.getValue().getAmount());
    }

    @Test
    void credit_duplicateSource_skipsIdempotently() {
        when(creditsTransactionMapper.countBySource(100L, "ORDER", "ORD-001")).thenReturn(1);

        creditsAccountService.credit(100L, new BigDecimal("10.0000"),
                CreditsTransactionType.EARN_SALE, "ORDER", "ORD-001", "重复入账");

        verify(creditsAccountMapper, never()).addBalance(any(), any(), any());
        verify(creditsTransactionMapper, never()).insert(any(CreditsTransaction.class));
    }

    @Test
    void credit_optimisticLockFailure_throwsException() {
        when(creditsAccountMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(account);
        when(creditsTransactionMapper.countBySource(any(), any(), any())).thenReturn(0);
        when(creditsAccountMapper.addBalance(any(), any(), any())).thenReturn(0);

        BusinessException ex = assertThrows(BusinessException.class, () ->
                creditsAccountService.credit(100L, new BigDecimal("10.0000"),
                        CreditsTransactionType.EARN_SALE, "ORDER", "ORD-001", "测试"));
        assertEquals("入账失败，请重试", ex.getMessage());
    }

    @Test
    void credit_invalidAmount_throwsException() {
        assertThrows(BusinessException.class, () ->
                creditsAccountService.credit(100L, BigDecimal.ZERO,
                        CreditsTransactionType.EARN_SALE, null, null, null));
        assertThrows(BusinessException.class, () ->
                creditsAccountService.credit(100L, new BigDecimal("-1"),
                        CreditsTransactionType.EARN_SALE, null, null, null));
    }

    @Test
    void debit_success_deductsBalanceAndCreatesTransaction() {
        when(creditsAccountMapper.selectOne(any(LambdaQueryWrapper.class)))
                .thenReturn(account)
                .thenReturn(account);
        when(creditsAccountMapper.deductBalance(100L, new BigDecimal("30.0000"), 5L)).thenReturn(1);

        creditsAccountService.debit(100L, new BigDecimal("30.0000"),
                CreditsTransactionType.SPEND_AGENT, "TASK", "TASK-001", "Agent 消耗");

        verify(creditsAccountMapper).deductBalance(100L, new BigDecimal("30.0000"), 5L);
        ArgumentCaptor<CreditsTransaction> txCaptor = ArgumentCaptor.forClass(CreditsTransaction.class);
        verify(creditsTransactionMapper).insert(txCaptor.capture());
        assertEquals(CreditsTransactionType.SPEND_AGENT.name(), txCaptor.getValue().getType());
        assertEquals(new BigDecimal("-30.0000"), txCaptor.getValue().getAmount());
    }

    @Test
    void debit_insufficientBalance_throwsException() {
        when(creditsAccountMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(account);

        BusinessException ex = assertThrows(BusinessException.class, () ->
                creditsAccountService.debit(100L, new BigDecimal("200.0000"),
                        CreditsTransactionType.SPEND_AGENT, null, null, null));
        assertEquals("Credits 余额不足", ex.getMessage());
    }

    @Test
    void debit_accountNotFound_throwsException() {
        when(creditsAccountMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);

        BusinessException ex = assertThrows(BusinessException.class, () ->
                creditsAccountService.debit(100L, new BigDecimal("10.0000"),
                        CreditsTransactionType.SPEND_AGENT, null, null, null));
        assertEquals("Credits 余额不足", ex.getMessage());
    }

    @Test
    void debit_optimisticLockFailure_throwsException() {
        when(creditsAccountMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(account);
        when(creditsAccountMapper.deductBalance(any(), any(), any())).thenReturn(0);

        BusinessException ex = assertThrows(BusinessException.class, () ->
                creditsAccountService.debit(100L, new BigDecimal("10.0000"),
                        CreditsTransactionType.SPEND_AGENT, null, null, null));
        assertEquals("出账失败，请重试", ex.getMessage());
    }

    @Test
    void debit_invalidAmount_throwsException() {
        assertThrows(BusinessException.class, () ->
                creditsAccountService.debit(100L, BigDecimal.ZERO,
                        CreditsTransactionType.SPEND_AGENT, null, null, null));
    }

    @Test
    void getTransactions_returnsPagedResults() {
        Page<CreditsTransaction> mockPage = new Page<>();
        mockPage.setRecords(List.of(new CreditsTransaction(), new CreditsTransaction()));
        when(creditsTransactionMapper.selectPage(any(Page.class), any(LambdaQueryWrapper.class)))
                .thenReturn(mockPage);

        Page<CreditsTransaction> result = creditsAccountService.getTransactions(100L, 1, 10);
        assertNotNull(result);
        assertEquals(2, result.getRecords().size());
    }

    @Test
    void freeze_success_reducesBalanceAndIncreasesFrozen() {
        when(creditsAccountMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(account);
        when(creditsAccountMapper.freezeBalance(100L, new BigDecimal("30.0000"), 5L)).thenReturn(1);

        creditsAccountService.freeze(100L, new BigDecimal("30.0000"));

        verify(creditsAccountMapper).freezeBalance(100L, new BigDecimal("30.0000"), 5L);
    }

    @Test
    void freeze_insufficientBalance_throwsException() {
        when(creditsAccountMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(account);

        BusinessException ex = assertThrows(BusinessException.class, () ->
                creditsAccountService.freeze(100L, new BigDecimal("200.0000")));
        assertEquals("Credits 余额不足", ex.getMessage());
    }

    @Test
    void freeze_invalidAmount_throwsException() {
        assertThrows(BusinessException.class, () ->
                creditsAccountService.freeze(100L, BigDecimal.ZERO));
    }

    @Test
    void unfreeze_success_restoresBalance() {
        account.setFrozenBalance(new BigDecimal("50.0000"));
        when(creditsAccountMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(account);
        when(creditsAccountMapper.unfreezeBalance(100L, new BigDecimal("30.0000"), 5L)).thenReturn(1);

        creditsAccountService.unfreeze(100L, new BigDecimal("30.0000"));

        verify(creditsAccountMapper).unfreezeBalance(100L, new BigDecimal("30.0000"), 5L);
    }

    @Test
    void unfreeze_insufficientFrozen_throwsException() {
        account.setFrozenBalance(new BigDecimal("10.0000"));
        when(creditsAccountMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(account);

        BusinessException ex = assertThrows(BusinessException.class, () ->
                creditsAccountService.unfreeze(100L, new BigDecimal("30.0000")));
        assertEquals("冻结余额不足", ex.getMessage());
    }

    @Test
    void deductFrozen_success_reducesFrozenAndIncreasesTotalWithdrawn() {
        account.setFrozenBalance(new BigDecimal("50.0000"));
        when(creditsAccountMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(account);
        when(creditsAccountMapper.deductFrozenBalance(100L, new BigDecimal("30.0000"), 5L)).thenReturn(1);

        creditsAccountService.deductFrozen(100L, new BigDecimal("30.0000"));

        verify(creditsAccountMapper).deductFrozenBalance(100L, new BigDecimal("30.0000"), 5L);
    }

    @Test
    void deductFrozen_insufficientFrozen_throwsException() {
        account.setFrozenBalance(new BigDecimal("10.0000"));
        when(creditsAccountMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(account);

        BusinessException ex = assertThrows(BusinessException.class, () ->
                creditsAccountService.deductFrozen(100L, new BigDecimal("30.0000")));
        assertEquals("冻结余额不足", ex.getMessage());
    }
}
