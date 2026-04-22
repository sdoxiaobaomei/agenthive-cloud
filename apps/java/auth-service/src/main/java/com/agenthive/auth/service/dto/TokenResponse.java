package com.agenthive.auth.service.dto;

import lombok.Data;

@Data
public class TokenResponse {

    private String accessToken;
    private String refreshToken;
    private Long expiresIn;
    private String tokenType;
}
