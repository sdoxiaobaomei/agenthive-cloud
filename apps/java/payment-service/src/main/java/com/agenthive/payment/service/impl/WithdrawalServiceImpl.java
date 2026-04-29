package com.agenthive.payment.service.impl;

import com.agenthive.payment.config.WithdrawalAccountEncryptor;
import com.agenthive.payment.config.WithdrawalConfig;
import com.agenthive.payment.domain.entity.CreditsAccount;
import com.agenthive.payment.domain.entity.CreditsTransaction;
import com.agenthive.payment.domain.entity.WithdrawalRecord;
import com.agenthive.payment.domain.enums.CreditsTransactionType;
import com.agenthive.payment.domain.enums.WithdrawalStatus;
import com.agenthive.payment.domain.vo.WithdrawalVO;
import com.agenthive.payment.internal.common.BusinessException;
import com.agenthive.payment.mapper.CreditsAccountMapper;
import com.agenthive.payment.mapper.CreditsTransactionMapper;
import com.agenthive.payment.mapper.WithdrawalRecordMapper;
import com.agenthive.payment.service.CreditsAccountService;
import com.agenthive.payment.service.WithdrawalService;
import com.agenthive.payment.service.dto.ApplyWithdrawalRequest;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class WithdrawalServiceImpl implements WithdrawalService {

    private final WithdrawalRecordMapper withdrawalRecordMapper;
    private final CreditsAccountMapper creditsAccountMapper;
    private final CreditsTransactionMapper creditsTransactionMapper;
    private final CreditsAccountService creditsAccountService;
    private final WithdrawalConfig withdrawalConfig;
    private final WithdrawalAccountEncryptor encryptor;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public WithdrawalVO applyWithdrawal(ApplyWithdrawalRequest request) {
        BigDecimal amount = request.getAmount();
        Long userId = request.getUserId();

        // 校验最低限额
        if (amount.compareTo(withdrawalConfig.getMinAmount()) < 0) {
            throw new BusinessException("提现金额不能低于 " + withdrawalConfig.getMinAmount());
        }

        // 校验余额充足（可用余额 = balance，不包含 frozen）
        CreditsAccount account = creditsAccountMapper.selectOne(
                new LambdaQueryWrapper<CreditsAccount>().eq(CreditsAccount::getUserId, userId));
        if (account == null || account.getBalance().compareTo(amount) < 0) {
            throw new BusinessException("Credits 余额不足");
        }

        // 风控：单日次数和总额
        checkDailyLimits(userId, amount);

        // 计算手续费
        BigDecimal feeRate = withdrawalConfig.getFeeRate();
        BigDecimal feeAmount = amount.multiply(feeRate).setScale(4, RoundingMode.HALF_UP);
        BigDecimal netAmount = amount.subtract(feeAmount);

        // 冻结余额
        creditsAccountService.freeze(userId, amount);

        // 创建提现记录
        WithdrawalRecord record = new WithdrawalRecord();
        record.setUserId(userId);
        record.setAmount(amount);
        record.setFeeRate(feeRate);
        record.setFeeAmount(feeAmount);
        record.setNetAmount(netAmount);
        record.setChannel(request.getChannel());
        record.setAccountInfoEncrypted(encryptor.encrypt(request.getAccountInfo()));
        record.setStatus(WithdrawalStatus.PENDING.name());
        record.setAppliedAt(LocalDateTime.now());
        record.setVersion(0L);
        record.setCreatedAt(LocalDateTime.now());
        record.setUpdatedAt(LocalDateTime.now());
        withdrawalRecordMapper.insert(record);

        log.info("Withdrawal applied: id={}, userId={}, amount={}, fee={}", record.getId(), userId, amount, feeAmount);

        // 小额自动审批
        if (amount.compareTo(withdrawalConfig.getAutoApproveThreshold()) <= 0) {
            log.info("Auto-approving withdrawal: id={}, amount={} <= threshold={}",
                    record.getId(), amount, withdrawalConfig.getAutoApproveThreshold());
            return approveWithdrawal(record.getId(), 0L);
        }

        return toVO(record);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public WithdrawalVO approveWithdrawal(Long id, Long adminId) {
        WithdrawalRecord record = withdrawalRecordMapper.selectById(id);
        if (record == null) {
            throw new BusinessException("提现记录不存在");
        }
        if (!WithdrawalStatus.PENDING.name().equals(record.getStatus())) {
            throw new BusinessException("提现记录状态不是待审批");
        }

        Long userId = record.getUserId();
        BigDecimal amount = record.getAmount();
        BigDecimal feeAmount = record.getFeeAmount();

        // 扣除冻结金额
        creditsAccountService.deductFrozen(userId, amount);

        // 查询最新余额用于流水
        CreditsAccount account = creditsAccountMapper.selectOne(
                new LambdaQueryWrapper<CreditsAccount>().eq(CreditsAccount::getUserId, userId));
        BigDecimal balanceAfter = account != null ? account.getBalance() : BigDecimal.ZERO;

        // 写入提现流水
        insertTransaction(userId, CreditsTransactionType.WITHDRAW, amount.negate(),
                balanceAfter, "WITHDRAWAL", String.valueOf(id),
                "提现扣除 " + amount);

        // 写入手续费流水
        if (feeAmount.compareTo(BigDecimal.ZERO) > 0) {
            insertTransaction(userId, CreditsTransactionType.FEE, feeAmount.negate(),
                    balanceAfter, "WITHDRAWAL", String.valueOf(id),
                    "提现手续费 " + feeAmount);
        }

        // 更新记录状态
        record.setStatus(WithdrawalStatus.APPROVED.name());
        record.setApprovedAt(LocalDateTime.now());
        record.setAdminId(adminId);
        record.setUpdatedAt(LocalDateTime.now());
        withdrawalRecordMapper.updateById(record);

        log.info("Withdrawal approved: id={}, userId={}, amount={}, adminId={}", id, userId, amount, adminId);
        return toVO(record);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public WithdrawalVO rejectWithdrawal(Long id, Long adminId, String rejectReason) {
        WithdrawalRecord record = withdrawalRecordMapper.selectById(id);
        if (record == null) {
            throw new BusinessException("提现记录不存在");
        }
        if (!WithdrawalStatus.PENDING.name().equals(record.getStatus())) {
            throw new BusinessException("提现记录状态不是待审批");
        }

        // 解冻余额
        creditsAccountService.unfreeze(record.getUserId(), record.getAmount());

        record.setStatus(WithdrawalStatus.REJECTED.name());
        record.setRejectReason(rejectReason);
        record.setAdminId(adminId);
        record.setUpdatedAt(LocalDateTime.now());
        withdrawalRecordMapper.updateById(record);

        log.info("Withdrawal rejected: id={}, userId={}, reason={}, adminId={}",
                id, record.getUserId(), rejectReason, adminId);
        return toVO(record);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public WithdrawalVO completeWithdrawal(Long id) {
        WithdrawalRecord record = withdrawalRecordMapper.selectById(id);
        if (record == null) {
            throw new BusinessException("提现记录不存在");
        }
        if (!WithdrawalStatus.APPROVED.name().equals(record.getStatus())
                && !WithdrawalStatus.PROCESSING.name().equals(record.getStatus())) {
            throw new BusinessException("提现记录状态不允许完成");
        }

        record.setStatus(WithdrawalStatus.COMPLETED.name());
        record.setCompletedAt(LocalDateTime.now());
        record.setUpdatedAt(LocalDateTime.now());
        withdrawalRecordMapper.updateById(record);

        log.info("Withdrawal completed: id={}, userId={}", id, record.getUserId());
        return toVO(record);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public WithdrawalVO failWithdrawal(Long id) {
        WithdrawalRecord record = withdrawalRecordMapper.selectById(id);
        if (record == null) {
            throw new BusinessException("提现记录不存在");
        }
        if (!WithdrawalStatus.APPROVED.name().equals(record.getStatus())
                && !WithdrawalStatus.PROCESSING.name().equals(record.getStatus())) {
            throw new BusinessException("提现记录状态不允许标记失败");
        }

        record.setStatus(WithdrawalStatus.FAILED.name());
        record.setUpdatedAt(LocalDateTime.now());
        withdrawalRecordMapper.updateById(record);

        log.info("Withdrawal failed: id={}, userId={}", id, record.getUserId());
        return toVO(record);
    }

    @Override
    public Page<WithdrawalVO> getWithdrawalList(Long userId, int page, int size) {
        LambdaQueryWrapper<WithdrawalRecord> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(WithdrawalRecord::getUserId, userId);
        wrapper.orderByDesc(WithdrawalRecord::getAppliedAt);
        Page<WithdrawalRecord> recordPage = withdrawalRecordMapper.selectPage(new Page<>(page, size), wrapper);
        Page<WithdrawalVO> voPage = new Page<>(recordPage.getCurrent(), recordPage.getSize(), recordPage.getTotal());
        voPage.setRecords(recordPage.getRecords().stream().map(this::toVO).toList());
        return voPage;
    }

    @Override
    public WithdrawalVO getWithdrawalDetail(Long id) {
        WithdrawalRecord record = withdrawalRecordMapper.selectById(id);
        if (record == null) {
            throw new BusinessException("提现记录不存在");
        }
        return toVO(record);
    }

    @Override
    public Page<WithdrawalVO> getAdminWithdrawalList(String status, int page, int size) {
        LambdaQueryWrapper<WithdrawalRecord> wrapper = new LambdaQueryWrapper<>();
        if (status != null && !status.isBlank()) {
            wrapper.eq(WithdrawalRecord::getStatus, status);
        }
        wrapper.orderByDesc(WithdrawalRecord::getAppliedAt);
        Page<WithdrawalRecord> recordPage = withdrawalRecordMapper.selectPage(new Page<>(page, size), wrapper);
        Page<WithdrawalVO> voPage = new Page<>(recordPage.getCurrent(), recordPage.getSize(), recordPage.getTotal());
        voPage.setRecords(recordPage.getRecords().stream().map(this::toVO).toList());
        return voPage;
    }

    private void checkDailyLimits(Long userId, BigDecimal amount) {
        LocalDateTime startOfDay = LocalDateTime.of(LocalDate.now(), LocalTime.MIN);
        LocalDateTime startOfNextDay = startOfDay.plusDays(1);

        int todayCount = withdrawalRecordMapper.countTodayByUserId(userId, startOfDay, startOfNextDay);
        if (todayCount >= withdrawalConfig.getMaxDailyCount()) {
            throw new BusinessException("今日提现次数已达上限");
        }

        BigDecimal todayAmount = withdrawalRecordMapper.sumTodayAmountByUserId(userId, startOfDay, startOfNextDay);
        if (todayAmount.add(amount).compareTo(withdrawalConfig.getMaxDailyAmount()) > 0) {
            throw new BusinessException("今日提现金额已达上限");
        }
    }

    private void insertTransaction(Long userId, CreditsTransactionType type, BigDecimal amount,
                                   BigDecimal balanceAfter, String sourceType, String sourceId, String description) {
        CreditsTransaction transaction = new CreditsTransaction();
        transaction.setUserId(userId);
        transaction.setType(type.name());
        transaction.setAmount(amount);
        transaction.setBalanceAfter(balanceAfter);
        transaction.setSourceType(sourceType);
        transaction.setSourceId(sourceId);
        transaction.setDescription(description);
        transaction.setCreatedAt(LocalDateTime.now());
        creditsTransactionMapper.insert(transaction);
    }

    private WithdrawalVO toVO(WithdrawalRecord record) {
        WithdrawalVO vo = new WithdrawalVO();
        vo.setId(record.getId());
        vo.setUserId(record.getUserId());
        vo.setAmount(record.getAmount());
        vo.setFeeRate(record.getFeeRate());
        vo.setFeeAmount(record.getFeeAmount());
        vo.setNetAmount(record.getNetAmount());
        vo.setChannel(record.getChannel());
        vo.setStatus(record.getStatus());
        vo.setAppliedAt(record.getAppliedAt());
        vo.setApprovedAt(record.getApprovedAt());
        vo.setCompletedAt(record.getCompletedAt());
        vo.setRejectReason(record.getRejectReason());
        vo.setAdminId(record.getAdminId());
        vo.setCreatedAt(record.getCreatedAt());
        vo.setUpdatedAt(record.getUpdatedAt());
        return vo;
    }
}
