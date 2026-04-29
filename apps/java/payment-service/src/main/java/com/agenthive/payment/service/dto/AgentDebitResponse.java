package com.agenthive.payment.service.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AgentDebitResponse {

    private boolean success;

    private BigDecimal creditsDeducted;

    private BigDecimal creditsRemaining;

    private String errorCode;
}
