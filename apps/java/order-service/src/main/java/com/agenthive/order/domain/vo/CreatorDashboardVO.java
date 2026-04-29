package com.agenthive.order.domain.vo;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class CreatorDashboardVO {

    private Integer activeProductCount;
    private Integer totalSales;
    private BigDecimal totalRevenue;
    private BigDecimal monthlyEarning;
}
