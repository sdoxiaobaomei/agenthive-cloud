package com.agenthive.payment.mapper;

import com.agenthive.payment.domain.entity.UserWallet;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;

import java.math.BigDecimal;

@Mapper
public interface UserWalletMapper extends BaseMapper<UserWallet> {

    @Update("UPDATE t_user_wallet SET balance = balance - #{amount}, version = version + 1, updated_at = NOW() " +
            "WHERE user_id = #{userId} AND version = #{version} AND balance >= #{amount}")
    int deductBalance(@Param("userId") Long userId, @Param("amount") BigDecimal amount, @Param("version") Long version);

    @Update("UPDATE t_user_wallet SET balance = balance + #{amount}, version = version + 1, updated_at = NOW() " +
            "WHERE user_id = #{userId} AND version = #{version}")
    int addBalance(@Param("userId") Long userId, @Param("amount") BigDecimal amount, @Param("version") Long version);
}
