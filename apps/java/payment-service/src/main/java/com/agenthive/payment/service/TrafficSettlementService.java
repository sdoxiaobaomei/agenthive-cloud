package com.agenthive.payment.service;

import com.agenthive.payment.service.dto.SettlementReport;

import java.time.LocalDate;

public interface TrafficSettlementService {

    SettlementReport settleTrafficForDate(LocalDate date);
}
