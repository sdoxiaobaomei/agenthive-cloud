package com.agenthive.auth.service;

import com.agenthive.auth.service.dto.LoginRequest;
import com.agenthive.auth.service.dto.RegisterRequest;
import com.agenthive.auth.service.dto.TokenResponse;
import com.agenthive.auth.domain.vo.UserVO;

public interface AuthService {

    TokenResponse register(RegisterRequest request);

    TokenResponse login(LoginRequest request, String clientIp);

    TokenResponse refresh(String refreshToken);

    void logout(String token);

    UserVO getCurrentUser(String token);
}
