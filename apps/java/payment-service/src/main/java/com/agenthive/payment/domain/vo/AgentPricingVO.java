package com.agenthive.payment.domain.vo;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class AgentPricingVO {

    private String workerRole;

    private String pricingType;

    private BigDecimal unitPrice;

    private BigDecimal tokenPrice;

    private String currency;
}
