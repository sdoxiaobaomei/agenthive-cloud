package com.agenthive.payment.service.impl;

import com.agenthive.payment.config.WithdrawalAccountEncryptor;
import com.agenthive.payment.config.WithdrawalConfig;
import com.agenthive.payment.domain.entity.CreditsAccount;
import com.agenthive.payment.domain.entity.CreditsTransaction;
import com.agenthive.payment.domain.entity.WithdrawalRecord;
import com.agenthive.payment.domain.enums.WithdrawalStatus;
import com.agenthive.payment.domain.vo.WithdrawalVO;
import com.agenthive.payment.internal.common.BusinessException;
import com.agenthive.payment.mapper.CreditsAccountMapper;
import com.agenthive.payment.mapper.CreditsTransactionMapper;
import com.agenthive.payment.mapper.WithdrawalRecordMapper;
import com.agenthive.payment.service.CreditsAccountService;
import com.agenthive.payment.service.dto.ApplyWithdrawalRequest;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@org.mockito.junit.jupiter.MockitoSettings(strictness = Strictness.LENIENT)
class WithdrawalServiceImplTest {

    @Mock
    private WithdrawalRecordMapper withdrawalRecordMapper;

    @Mock
    private CreditsAccountMapper creditsAccountMapper;

    @Mock
    private CreditsTransactionMapper creditsTransactionMapper;

    @Mock
    private CreditsAccountService creditsAccountService;

    @Mock
    private WithdrawalConfig withdrawalConfig;

    @Mock
    private WithdrawalAccountEncryptor encryptor;

    @InjectMocks
    private WithdrawalServiceImpl withdrawalService;

    @BeforeEach
    void setUp() {
        when(withdrawalConfig.getFeeRate()).thenReturn(new BigDecimal("0.10"));
        when(withdrawalConfig.getMinAmount()).thenReturn(new BigDecimal("100"));
        when(withdrawalConfig.getMaxDailyCount()).thenReturn(3);
        when(withdrawalConfig.getMaxDailyAmount()).thenReturn(new BigDecimal("10000"));
        when(withdrawalConfig.getAutoApproveThreshold()).thenReturn(new BigDecimal("5000"));
        when(encryptor.encrypt(anyString())).thenReturn("encrypted-data");
    }

    @Test
    void applyWithdrawal_success_createsRecordAndFreezes() {
        ApplyWithdrawalRequest request = new ApplyWithdrawalRequest();
        request.setUserId(100L);
        request.setAmount(new BigDecimal("6000"));
        request.setChannel("ALIPAY");
        request.setAccountInfo("test@alipay.com");

        CreditsAccount account = new CreditsAccount();
        account.setUserId(100L);
        account.setBalance(new BigDecimal("10000"));
        account.setVersion(1L);

        when(creditsAccountMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(account);
        when(withdrawalRecordMapper.countTodayByUserId(any(), any(), any())).thenReturn(0);
        when(withdrawalRecordMapper.sumTodayAmountByUserId(any(), any(), any())).thenReturn(BigDecimal.ZERO);
        when(withdrawalRecordMapper.insert(any(WithdrawalRecord.class))).thenAnswer(inv -> {
            WithdrawalRecord r = inv.getArgument(0);
            r.setId(1L);
            return 1;
        });

        WithdrawalVO vo = withdrawalService.applyWithdrawal(request);

        assertNotNull(vo);
        assertEquals(WithdrawalStatus.PENDING.name(), vo.getStatus());
        assertEquals(0, new BigDecimal("6000").compareTo(vo.getAmount()));
        assertEquals(0, new BigDecimal("600").compareTo(vo.getFeeAmount()));
        assertEquals(0, new BigDecimal("5400").compareTo(vo.getNetAmount()));
        verify(creditsAccountService).freeze(100L, new BigDecimal("6000"));
        verify(withdrawalRecordMapper).insert(any(WithdrawalRecord.class));
    }

    @Test
    void applyWithdrawal_smallAmount_autoApproves() {
        ApplyWithdrawalRequest request = new ApplyWithdrawalRequest();
        request.setUserId(100L);
        request.setAmount(new BigDecimal("100"));
        request.setChannel("ALIPAY");
        request.setAccountInfo("test@alipay.com");

        CreditsAccount account = new CreditsAccount();
        account.setUserId(100L);
        account.setBalance(new BigDecimal("5000"));
        account.setVersion(1L);

        WithdrawalRecord record = new WithdrawalRecord();
        record.setId(1L);
        record.setUserId(100L);
        record.setAmount(new BigDecimal("100"));
        record.setFeeAmount(new BigDecimal("10"));
        record.setStatus(WithdrawalStatus.PENDING.name());

        when(creditsAccountMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(account);
        when(withdrawalRecordMapper.countTodayByUserId(any(), any(), any())).thenReturn(0);
        when(withdrawalRecordMapper.sumTodayAmountByUserId(any(), any(), any())).thenReturn(BigDecimal.ZERO);
        when(withdrawalRecordMapper.insert(any(WithdrawalRecord.class))).thenAnswer(inv -> {
            WithdrawalRecord r = inv.getArgument(0);
            r.setId(1L);
            return 1;
        });
        when(withdrawalRecordMapper.selectById(1L)).thenReturn(record);
        doNothing().when(creditsAccountService).deductFrozen(anyLong(), any(BigDecimal.class));
        when(creditsTransactionMapper.insert(any(CreditsTransaction.class))).thenReturn(1);
        when(withdrawalRecordMapper.updateById(any(WithdrawalRecord.class))).thenReturn(1);

        WithdrawalVO vo = withdrawalService.applyWithdrawal(request);

        assertEquals(WithdrawalStatus.APPROVED.name(), vo.getStatus());
        verify(creditsAccountService).deductFrozen(100L, new BigDecimal("100"));
    }

    @Test
    void applyWithdrawal_insufficientBalance_throwsException() {
        ApplyWithdrawalRequest request = new ApplyWithdrawalRequest();
        request.setUserId(100L);
        request.setAmount(new BigDecimal("1000"));
        request.setChannel("ALIPAY");
        request.setAccountInfo("test@alipay.com");

        CreditsAccount account = new CreditsAccount();
        account.setUserId(100L);
        account.setBalance(new BigDecimal("500"));

        when(creditsAccountMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(account);

        BusinessException ex = assertThrows(BusinessException.class, () ->
                withdrawalService.applyWithdrawal(request));
        assertEquals("Credits 余额不足", ex.getMessage());
    }

    @Test
    void applyWithdrawal_belowMinAmount_throwsException() {
        ApplyWithdrawalRequest request = new ApplyWithdrawalRequest();
        request.setUserId(100L);
        request.setAmount(new BigDecimal("50"));
        request.setChannel("ALIPAY");
        request.setAccountInfo("test@alipay.com");

        BusinessException ex = assertThrows(BusinessException.class, () ->
                withdrawalService.applyWithdrawal(request));
        assertTrue(ex.getMessage().contains("提现金额不能低于"));
    }

    @Test
    void applyWithdrawal_exceedDailyCount_throwsException() {
        ApplyWithdrawalRequest request = new ApplyWithdrawalRequest();
        request.setUserId(100L);
        request.setAmount(new BigDecimal("1000"));
        request.setChannel("ALIPAY");
        request.setAccountInfo("test@alipay.com");

        CreditsAccount account = new CreditsAccount();
        account.setUserId(100L);
        account.setBalance(new BigDecimal("5000"));

        when(creditsAccountMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(account);
        when(withdrawalRecordMapper.countTodayByUserId(any(), any(), any())).thenReturn(3);

        BusinessException ex = assertThrows(BusinessException.class, () ->
                withdrawalService.applyWithdrawal(request));
        assertEquals("今日提现次数已达上限", ex.getMessage());
    }

    @Test
    void applyWithdrawal_exceedDailyAmount_throwsException() {
        ApplyWithdrawalRequest request = new ApplyWithdrawalRequest();
        request.setUserId(100L);
        request.setAmount(new BigDecimal("5000"));
        request.setChannel("ALIPAY");
        request.setAccountInfo("test@alipay.com");

        CreditsAccount account = new CreditsAccount();
        account.setUserId(100L);
        account.setBalance(new BigDecimal("10000"));

        when(creditsAccountMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(account);
        when(withdrawalRecordMapper.countTodayByUserId(any(), any(), any())).thenReturn(1);
        when(withdrawalRecordMapper.sumTodayAmountByUserId(any(), any(), any())).thenReturn(new BigDecimal("6000"));

        BusinessException ex = assertThrows(BusinessException.class, () ->
                withdrawalService.applyWithdrawal(request));
        assertEquals("今日提现金额已达上限", ex.getMessage());
    }

    @Test
    void approveWithdrawal_success_deductsFrozenAndRecordsTransactions() {
        WithdrawalRecord record = new WithdrawalRecord();
        record.setId(1L);
        record.setUserId(100L);
        record.setAmount(new BigDecimal("1000"));
        record.setFeeAmount(new BigDecimal("100"));
        record.setStatus(WithdrawalStatus.PENDING.name());
        record.setVersion(1L);

        CreditsAccount account = new CreditsAccount();
        account.setUserId(100L);
        account.setBalance(new BigDecimal("4000"));

        when(withdrawalRecordMapper.selectById(1L)).thenReturn(record);
        doNothing().when(creditsAccountService).deductFrozen(100L, new BigDecimal("1000"));
        when(creditsAccountMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(account);
        when(creditsTransactionMapper.insert(any(CreditsTransaction.class))).thenReturn(1);
        when(withdrawalRecordMapper.updateById(any(WithdrawalRecord.class))).thenReturn(1);

        WithdrawalVO vo = withdrawalService.approveWithdrawal(1L, 1L);

        assertEquals(WithdrawalStatus.APPROVED.name(), vo.getStatus());
        verify(creditsAccountService).deductFrozen(100L, new BigDecimal("1000"));
        verify(creditsTransactionMapper, times(2)).insert(any(CreditsTransaction.class));
    }

    @Test
    void approveWithdrawal_notPending_throwsException() {
        WithdrawalRecord record = new WithdrawalRecord();
        record.setId(1L);
        record.setStatus(WithdrawalStatus.APPROVED.name());

        when(withdrawalRecordMapper.selectById(1L)).thenReturn(record);

        BusinessException ex = assertThrows(BusinessException.class, () ->
                withdrawalService.approveWithdrawal(1L, 1L));
        assertEquals("提现记录状态不是待审批", ex.getMessage());
    }

    @Test
    void rejectWithdrawal_success_unfreezesBalance() {
        WithdrawalRecord record = new WithdrawalRecord();
        record.setId(1L);
        record.setUserId(100L);
        record.setAmount(new BigDecimal("1000"));
        record.setStatus(WithdrawalStatus.PENDING.name());
        record.setVersion(1L);

        when(withdrawalRecordMapper.selectById(1L)).thenReturn(record);
        doNothing().when(creditsAccountService).unfreeze(100L, new BigDecimal("1000"));
        when(withdrawalRecordMapper.updateById(any(WithdrawalRecord.class))).thenReturn(1);

        WithdrawalVO vo = withdrawalService.rejectWithdrawal(1L, 1L, "风控拦截");

        assertEquals(WithdrawalStatus.REJECTED.name(), vo.getStatus());
        assertEquals("风控拦截", vo.getRejectReason());
        verify(creditsAccountService).unfreeze(100L, new BigDecimal("1000"));
    }

    @Test
    void completeWithdrawal_success_updatesStatus() {
        WithdrawalRecord record = new WithdrawalRecord();
        record.setId(1L);
        record.setStatus(WithdrawalStatus.APPROVED.name());

        when(withdrawalRecordMapper.selectById(1L)).thenReturn(record);
        when(withdrawalRecordMapper.updateById(any(WithdrawalRecord.class))).thenReturn(1);

        WithdrawalVO vo = withdrawalService.completeWithdrawal(1L);

        assertEquals(WithdrawalStatus.COMPLETED.name(), vo.getStatus());
    }

    @Test
    void failWithdrawal_success_updatesStatus() {
        WithdrawalRecord record = new WithdrawalRecord();
        record.setId(1L);
        record.setStatus(WithdrawalStatus.PROCESSING.name());

        when(withdrawalRecordMapper.selectById(1L)).thenReturn(record);
        when(withdrawalRecordMapper.updateById(any(WithdrawalRecord.class))).thenReturn(1);

        WithdrawalVO vo = withdrawalService.failWithdrawal(1L);

        assertEquals(WithdrawalStatus.FAILED.name(), vo.getStatus());
    }

    @Test
    void getWithdrawalList_returnsPagedResults() {
        WithdrawalRecord record = new WithdrawalRecord();
        record.setId(1L);
        record.setUserId(100L);
        record.setAmount(new BigDecimal("1000"));
        record.setStatus(WithdrawalStatus.PENDING.name());

        Page<WithdrawalRecord> mockPage = new Page<>();
        mockPage.setRecords(List.of(record));
        mockPage.setTotal(1);

        when(withdrawalRecordMapper.selectPage(any(Page.class), any(LambdaQueryWrapper.class))).thenReturn(mockPage);

        Page<WithdrawalVO> result = withdrawalService.getWithdrawalList(100L, 1, 10);

        assertNotNull(result);
        assertEquals(1, result.getRecords().size());
    }

    @Test
    void getWithdrawalDetail_notFound_throwsException() {
        when(withdrawalRecordMapper.selectById(99L)).thenReturn(null);

        BusinessException ex = assertThrows(BusinessException.class, () ->
                withdrawalService.getWithdrawalDetail(99L));
        assertEquals("提现记录不存在", ex.getMessage());
    }
}
