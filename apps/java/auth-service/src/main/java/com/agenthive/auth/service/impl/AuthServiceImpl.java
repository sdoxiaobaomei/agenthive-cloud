package com.agenthive.auth.service.impl;

import com.agenthive.auth.domain.entity.SysRole;
import com.agenthive.auth.domain.entity.SysUser;
import com.agenthive.auth.domain.entity.SysUserRole;
import com.agenthive.auth.domain.vo.UserVO;
import com.agenthive.auth.mapper.RoleMapper;
import com.agenthive.auth.mapper.UserMapper;
import com.agenthive.auth.mapper.UserRoleMapper;
import com.agenthive.auth.service.AuthService;
import com.agenthive.auth.service.SmsService;
import com.agenthive.auth.service.dto.LoginRequest;
import com.agenthive.auth.service.dto.RegisterRequest;
import com.agenthive.auth.service.dto.SmsLoginRequest;
import com.agenthive.auth.service.dto.TokenResponse;
import com.agenthive.auth.service.dto.VerifySmsCodeRequest;
import com.agenthive.common.core.exception.AgentHiveException;
import com.agenthive.common.core.result.ResultCode;
import com.agenthive.common.security.util.JwtUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final UserMapper userMapper;
    private final RoleMapper roleMapper;
    private final UserRoleMapper userRoleMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtils jwtUtils;
    private final StringRedisTemplate stringRedisTemplate;
    private final SmsService smsService;

    @Value("${jwt.access-expiration:3600000}")
    private long accessExpiration;

    private static final Pattern PASSWORD_PATTERN = Pattern.compile(
            "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$");

    @Override
    @Transactional
    public TokenResponse register(RegisterRequest request) {
        if (!PASSWORD_PATTERN.matcher(request.getPassword()).matches()) {
            throw new AgentHiveException(ResultCode.PASSWORD_TOO_WEAK.getCode(),
                    "Password must contain uppercase, lowercase, digit and special character");
        }

        SysUser existing = userMapper.selectByUsername(request.getUsername());
        if (existing != null) {
            throw new AgentHiveException(ResultCode.USER_ALREADY_EXISTS);
        }

        SysUser user = new SysUser();
        user.setUsername(request.getUsername());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setEmail(request.getEmail());
        user.setStatus(1);
        userMapper.insert(user);

        SysUserRole userRole = new SysUserRole();
        userRole.setUserId(user.getId());
        userRole.setRoleId(2L);
        userRoleMapper.insert(userRole);

        return generateTokens(user);
    }

    @Override
    public TokenResponse login(LoginRequest request, String clientIp) {
        String rateKey = "login:rate:" + clientIp;
        String attemptsStr = stringRedisTemplate.opsForValue().get(rateKey);
        int attempts = attemptsStr == null ? 0 : Integer.parseInt(attemptsStr);
        if (attempts >= 5) {
            throw new AgentHiveException(ResultCode.RATE_LIMIT_EXCEEDED.getCode(),
                    "Too many login attempts. Please try again later.");
        }

        SysUser user = userMapper.selectByUsername(request.getUsername());
        if (user == null || !passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            stringRedisTemplate.opsForValue().increment(rateKey);
            stringRedisTemplate.expire(rateKey, 1, TimeUnit.MINUTES);
            throw new AgentHiveException(ResultCode.INVALID_CREDENTIALS);
        }

        if (user.getStatus() != 1) {
            throw new AgentHiveException(ResultCode.FORBIDDEN.getCode(), "Account is disabled");
        }

        stringRedisTemplate.delete(rateKey);
        return generateTokens(user);
    }

    @Override
    public TokenResponse smsLogin(SmsLoginRequest request, String clientIp) {
        String rateKey = "login:rate:" + clientIp;
        String attemptsStr = stringRedisTemplate.opsForValue().get(rateKey);
        int attempts = attemptsStr == null ? 0 : Integer.parseInt(attemptsStr);
        if (attempts >= 5) {
            throw new AgentHiveException(ResultCode.RATE_LIMIT_EXCEEDED.getCode(),
                    "Too many login attempts. Please try again later.");
        }

        // 验证短信验证码
        VerifySmsCodeRequest verifyRequest = new VerifySmsCodeRequest();
        verifyRequest.setPhone(request.getPhone());
        verifyRequest.setCode(request.getCode());
        verifyRequest.setTemplateType("LOGIN_REGISTER");
        smsService.verifyCode(verifyRequest);

        SysUser user = userMapper.selectByPhone(request.getPhone());
        if (user == null) {
            // 短信登录即注册：自动创建用户
            user = autoRegisterByPhone(request.getPhone());
        }

        if (user.getStatus() != 1) {
            throw new AgentHiveException(ResultCode.FORBIDDEN.getCode(), "Account is disabled");
        }

        stringRedisTemplate.delete(rateKey);
        return generateTokens(user);
    }

    @Override
    public TokenResponse refresh(String refreshToken) {
        if (!jwtUtils.validateToken(refreshToken)) {
            throw new AgentHiveException(ResultCode.INVALID_TOKEN);
        }
        String subject = jwtUtils.getSubject(refreshToken);
        SysUser user = userMapper.selectById(Long.valueOf(subject));
        if (user == null || user.getStatus() != 1) {
            throw new AgentHiveException(ResultCode.INVALID_TOKEN);
        }
        return generateTokens(user);
    }

    @Override
    public void logout(String token) {
        if (token != null && jwtUtils.validateToken(token)) {
            long remaining = jwtUtils.getExpiration(token).getTime() - System.currentTimeMillis();
            if (remaining > 0) {
                stringRedisTemplate.opsForValue().set("blacklist:" + token, "1",
                        Duration.ofMillis(remaining));
            }
        }
    }

    @Override
    public UserVO getCurrentUser(String token) {
        if (!jwtUtils.validateToken(token)) {
            throw new AgentHiveException(ResultCode.INVALID_TOKEN);
        }
        String userId = jwtUtils.getSubject(token);
        SysUser user = userMapper.selectById(Long.valueOf(userId));
        if (user == null) {
            throw new AgentHiveException(ResultCode.USER_NOT_FOUND);
        }
        return toUserVO(user);
    }

    @Override
    public List<String> getUserRoles(Long userId) {
        List<SysRole> roles = roleMapper.selectRolesByUserId(userId);
        return roles.stream().map(SysRole::getRoleCode).toList();
    }

    private TokenResponse generateTokens(SysUser user) {
        TokenResponse response = new TokenResponse();
        List<String> roles = roleMapper.selectRolesByUserId(user.getId())
                .stream().map(SysRole::getRoleCode).toList();
        String accessToken = jwtUtils.generateAccessToken(String.valueOf(user.getId()),
                Map.of("username", user.getUsername(), "roles", String.join(",", roles)));
        String refreshToken = jwtUtils.generateRefreshToken(String.valueOf(user.getId()));
        response.setAccessToken(accessToken);
        response.setRefreshToken(refreshToken);
        response.setExpiresIn(accessExpiration / 1000);
        response.setTokenType("Bearer");
        return response;
    }

    private SysUser autoRegisterByPhone(String phone) {
        SysUser user = new SysUser();
        String username = "phone_" + phone.substring(phone.length() - 4);
        int suffix = 1;
        while (userMapper.selectByUsername(username) != null) {
            username = "phone_" + phone.substring(phone.length() - 4) + "_" + suffix++;
        }
        user.setUsername(username);
        // 随机生成临时密码（用户后续可通过重置密码修改）
        user.setPassword(passwordEncoder.encode(java.util.UUID.randomUUID().toString().substring(0, 12)));
        user.setPhone(phone);
        user.setStatus(1);
        userMapper.insert(user);

        SysUserRole userRole = new SysUserRole();
        userRole.setUserId(user.getId());
        userRole.setRoleId(2L);
        userRoleMapper.insert(userRole);

        log.info("Auto-registered user by phone: {}, username: {}", phone, username);
        return user;
    }

    private UserVO toUserVO(SysUser user) {
        UserVO vo = new UserVO();
        vo.setId(user.getId());
        vo.setUsername(user.getUsername());
        vo.setEmail(user.getEmail());
        vo.setPhone(user.getPhone());
        vo.setAvatar(user.getAvatar());
        vo.setStatus(user.getStatus());
        vo.setCreatedAt(user.getCreatedAt());
        List<SysRole> roles = roleMapper.selectRolesByUserId(user.getId());
        vo.setRoles(roles.stream().map(SysRole::getRoleCode).toList());
        return vo;
    }
}
