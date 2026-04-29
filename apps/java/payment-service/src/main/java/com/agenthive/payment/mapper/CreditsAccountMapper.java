package com.agenthive.payment.mapper;

import com.agenthive.payment.domain.entity.CreditsAccount;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;

import java.math.BigDecimal;

@Mapper
public interface CreditsAccountMapper extends BaseMapper<CreditsAccount> {

    @Update("UPDATE t_credits_account SET balance = balance + #{amount}, total_earned = total_earned + #{amount}, version = version + 1, updated_at = NOW() " +
            "WHERE user_id = #{userId} AND version = #{version}")
    int addBalance(@Param("userId") Long userId, @Param("amount") BigDecimal amount, @Param("version") Long version);

    @Update("UPDATE t_credits_account SET balance = balance - #{amount}, total_spent = total_spent + #{amount}, version = version + 1, updated_at = NOW() " +
            "WHERE user_id = #{userId} AND version = #{version} AND balance >= #{amount}")
    int deductBalance(@Param("userId") Long userId, @Param("amount") BigDecimal amount, @Param("version") Long version);

    @Update("UPDATE t_credits_account SET balance = balance - #{amount}, frozen_balance = frozen_balance + #{amount}, version = version + 1, updated_at = NOW() " +
            "WHERE user_id = #{userId} AND version = #{version} AND balance >= #{amount}")
    int freezeBalance(@Param("userId") Long userId, @Param("amount") BigDecimal amount, @Param("version") Long version);

    @Update("UPDATE t_credits_account SET balance = balance + #{amount}, frozen_balance = frozen_balance - #{amount}, version = version + 1, updated_at = NOW() " +
            "WHERE user_id = #{userId} AND version = #{version} AND frozen_balance >= #{amount}")
    int unfreezeBalance(@Param("userId") Long userId, @Param("amount") BigDecimal amount, @Param("version") Long version);

    @Update("UPDATE t_credits_account SET frozen_balance = frozen_balance - #{amount}, total_withdrawn = total_withdrawn + #{amount}, version = version + 1, updated_at = NOW() " +
            "WHERE user_id = #{userId} AND version = #{version} AND frozen_balance >= #{amount}")
    int deductFrozenBalance(@Param("userId") Long userId, @Param("amount") BigDecimal amount, @Param("version") Long version);
}
