package com.agenthive.payment.service.impl;

import com.agenthive.payment.domain.entity.UserWallet;
import com.agenthive.payment.domain.vo.WalletVO;
import com.agenthive.payment.internal.common.BusinessException;
import com.agenthive.payment.mapper.UserWalletMapper;
import com.agenthive.payment.service.WalletService;
import com.agenthive.payment.service.dto.RechargeRequest;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class WalletServiceImpl implements WalletService {

    private final UserWalletMapper userWalletMapper;

    @Override
    public WalletVO getWallet(Long userId) {
        UserWallet wallet = userWalletMapper.selectOne(
                new LambdaQueryWrapper<UserWallet>().eq(UserWallet::getUserId, userId));
        if (wallet == null) {
            wallet = new UserWallet();
            wallet.setUserId(userId);
            wallet.setBalance(new java.math.BigDecimal("0.00"));
            wallet.setFrozenBalance(new java.math.BigDecimal("0.00"));
            wallet.setVersion(0L);
            wallet.setUpdatedAt(LocalDateTime.now());
            userWalletMapper.insert(wallet);
        }
        WalletVO vo = new WalletVO();
        vo.setUserId(wallet.getUserId());
        vo.setBalance(wallet.getBalance());
        vo.setFrozenBalance(wallet.getFrozenBalance());
        vo.setUpdatedAt(wallet.getUpdatedAt());
        return vo;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public WalletVO recharge(RechargeRequest request) {
        UserWallet wallet = userWalletMapper.selectOne(
                new LambdaQueryWrapper<UserWallet>().eq(UserWallet::getUserId, request.getUserId()));
        if (wallet == null) {
            wallet = new UserWallet();
            wallet.setUserId(request.getUserId());
            wallet.setBalance(request.getAmount());
            wallet.setFrozenBalance(new java.math.BigDecimal("0.00"));
            wallet.setVersion(0L);
            wallet.setUpdatedAt(LocalDateTime.now());
            userWalletMapper.insert(wallet);
        } else {
            int rows = userWalletMapper.addBalance(request.getUserId(), request.getAmount(), wallet.getVersion());
            if (rows == 0) {
                throw new BusinessException("充值失败，请重试");
            }
            wallet = userWalletMapper.selectOne(
                    new LambdaQueryWrapper<UserWallet>().eq(UserWallet::getUserId, request.getUserId()));
        }
        WalletVO vo = new WalletVO();
        vo.setUserId(wallet.getUserId());
        vo.setBalance(wallet.getBalance());
        vo.setFrozenBalance(wallet.getFrozenBalance());
        vo.setUpdatedAt(wallet.getUpdatedAt());
        return vo;
    }
}
