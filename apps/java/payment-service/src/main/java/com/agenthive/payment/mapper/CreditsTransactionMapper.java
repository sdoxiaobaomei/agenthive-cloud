package com.agenthive.payment.mapper;

import com.agenthive.payment.domain.entity.CreditsTransaction;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface CreditsTransactionMapper extends BaseMapper<CreditsTransaction> {

    @Select("SELECT COUNT(*) FROM t_credits_transaction WHERE user_id = #{userId} AND source_type = #{sourceType} AND source_id = #{sourceId}")
    int countBySource(@Param("userId") Long userId, @Param("sourceType") String sourceType, @Param("sourceId") String sourceId);
}
