package com.agenthive.payment.mapper;

import com.agenthive.payment.domain.entity.Payment;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface PaymentMapper extends BaseMapper<Payment> {

    @Select("SELECT * FROM t_payment WHERE order_no = #{orderNo} LIMIT 1")
    Payment selectByOrderNo(@Param("orderNo") String orderNo);

    @Select("SELECT * FROM t_payment WHERE payment_no = #{paymentNo} LIMIT 1")
    Payment selectByPaymentNo(@Param("paymentNo") String paymentNo);
}
