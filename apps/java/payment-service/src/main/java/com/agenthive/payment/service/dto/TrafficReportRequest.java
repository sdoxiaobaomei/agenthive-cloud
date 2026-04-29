package com.agenthive.payment.service.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
public class TrafficReportRequest {

    @NotNull
    private Long websiteId;

    @NotBlank
    private String ip;

    @NotBlank
    private String sessionId;

    @NotNull
    private Instant timestamp;

    private Integer pv = 1;
}
