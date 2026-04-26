package com.agenthive.auth.controller;

import com.agenthive.auth.domain.vo.UserVO;
import com.agenthive.auth.service.AuthService;
import com.agenthive.auth.service.dto.LoginRequest;
import com.agenthive.auth.service.dto.RefreshTokenRequest;
import com.agenthive.auth.service.dto.RegisterRequest;
import com.agenthive.auth.service.dto.SmsLoginRequest;
import com.agenthive.auth.service.dto.TokenResponse;
import com.agenthive.auth.service.dto.UpdateProfileRequest;
import com.agenthive.common.core.result.Result;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public Result<TokenResponse> register(@Valid @RequestBody RegisterRequest request) {
        return Result.success(authService.register(request));
    }

    @PostMapping("/login")
    public Result<TokenResponse> login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        String clientIp = getClientIp(httpRequest);
        return Result.success(authService.login(request, clientIp));
    }

    @PostMapping("/login/sms")
    public Result<TokenResponse> smsLogin(@Valid @RequestBody SmsLoginRequest request, HttpServletRequest httpRequest) {
        String clientIp = getClientIp(httpRequest);
        return Result.success(authService.smsLogin(request, clientIp));
    }

    @PostMapping("/refresh")
    public Result<TokenResponse> refresh(@Valid @RequestBody RefreshTokenRequest request) {
        return Result.success(authService.refresh(request.getRefreshToken()));
    }

    @PostMapping("/logout")
    public Result<Void> logout(@RequestHeader("Authorization") String authHeader) {
        String token = authHeader != null && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null;
        authService.logout(token);
        return Result.success();
    }

    @GetMapping("/me")
    public Result<UserVO> me(@RequestHeader("Authorization") String authHeader) {
        String token = authHeader != null && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null;
        return Result.success(authService.getCurrentUser(token));
    }

    @PatchMapping("/profile")
    public Result<UserVO> updateProfile(
            @RequestHeader("Authorization") String authHeader,
            @Valid @RequestBody UpdateProfileRequest request) {
        String token = authHeader != null && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null;
        UserVO currentUser = authService.getCurrentUser(token);
        return Result.success(authService.updateProfile(currentUser.getId(), request));
    }

    @GetMapping("/users/{id}/roles")
    public Result<List<String>> getUserRoles(@PathVariable("id") Long id) {
        return Result.success(authService.getUserRoles(id));
    }

    private String getClientIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("Proxy-Client-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }
        if (ip != null && ip.contains(",")) {
            ip = ip.split(",")[0].trim();
        }
        return ip;
    }
}
