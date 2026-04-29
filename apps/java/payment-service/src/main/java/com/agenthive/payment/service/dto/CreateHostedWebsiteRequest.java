package com.agenthive.payment.service.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreateHostedWebsiteRequest {

    @NotNull
    private Long projectId;

    @NotNull
    private Long ownerId;

    @NotBlank
    private String projectName;
}
