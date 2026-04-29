package com.agenthive.payment.service;

import com.agenthive.payment.domain.vo.WithdrawalVO;
import com.agenthive.payment.service.dto.ApplyWithdrawalRequest;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;

public interface WithdrawalService {

    WithdrawalVO applyWithdrawal(ApplyWithdrawalRequest request);

    WithdrawalVO approveWithdrawal(Long id, Long adminId);

    WithdrawalVO rejectWithdrawal(Long id, Long adminId, String rejectReason);

    WithdrawalVO completeWithdrawal(Long id);

    WithdrawalVO failWithdrawal(Long id);

    Page<WithdrawalVO> getWithdrawalList(Long userId, int page, int size);

    WithdrawalVO getWithdrawalDetail(Long id);

    Page<WithdrawalVO> getAdminWithdrawalList(String status, int page, int size);
}
