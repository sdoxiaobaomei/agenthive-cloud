package com.agenthive.auth.service;

import com.agenthive.auth.service.dto.LoginRequest;
import com.agenthive.auth.service.dto.RegisterRequest;
import com.agenthive.auth.service.dto.SmsLoginRequest;
import com.agenthive.auth.service.dto.TokenResponse;
import com.agenthive.auth.service.dto.UpdateProfileRequest;
import com.agenthive.auth.domain.vo.UserVO;

import java.util.List;

public interface AuthService {

    TokenResponse register(RegisterRequest request);

    TokenResponse login(LoginRequest request, String clientIp);

    TokenResponse smsLogin(SmsLoginRequest request, String clientIp);

    TokenResponse refresh(String refreshToken);

    void logout(String token);

    UserVO getCurrentUser(String token);

    List<String> getUserRoles(Long userId);

    UserVO updateProfile(Long userId, UpdateProfileRequest request);
}
