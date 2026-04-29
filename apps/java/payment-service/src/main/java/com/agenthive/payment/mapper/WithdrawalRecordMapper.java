package com.agenthive.payment.mapper;

import com.agenthive.payment.domain.entity.WithdrawalRecord;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Mapper
public interface WithdrawalRecordMapper extends BaseMapper<WithdrawalRecord> {

    @Select("SELECT COUNT(*) FROM t_withdrawal_record WHERE user_id = #{userId} AND applied_at >= #{startOfDay} AND applied_at < #{startOfNextDay}")
    int countTodayByUserId(@Param("userId") Long userId,
                           @Param("startOfDay") LocalDateTime startOfDay,
                           @Param("startOfNextDay") LocalDateTime startOfNextDay);

    @Select("SELECT COALESCE(SUM(amount), 0) FROM t_withdrawal_record WHERE user_id = #{userId} AND applied_at >= #{startOfDay} AND applied_at < #{startOfNextDay}")
    BigDecimal sumTodayAmountByUserId(@Param("userId") Long userId,
                                      @Param("startOfDay") LocalDateTime startOfDay,
                                      @Param("startOfNextDay") LocalDateTime startOfNextDay);
}
