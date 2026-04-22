package com.agenthive.payment.service;

import com.agenthive.payment.domain.vo.WalletVO;
import com.agenthive.payment.service.dto.RechargeRequest;

public interface WalletService {
    WalletVO getWallet(Long userId);
    WalletVO recharge(RechargeRequest request);
}
