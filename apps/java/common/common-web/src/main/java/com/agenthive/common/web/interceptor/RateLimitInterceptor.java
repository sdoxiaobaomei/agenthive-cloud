package com.agenthive.common.web.interceptor;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.env.Environment;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class RateLimitInterceptor implements HandlerInterceptor {

    private final StringRedisTemplate stringRedisTemplate;
    private final Environment environment;

    private static final String LUA_SCRIPT =
            "local key = KEYS[1]; " +
            "local limit = tonumber(ARGV[1]); " +
            "local window = tonumber(ARGV[2]); " +
            "local current = redis.call('GET', key); " +
            "if current == false then " +
            "  redis.call('SET', key, 1, 'EX', window); " +
            "  return 1; " +
            "end " +
            "local count = tonumber(current); " +
            "if count >= limit then " +
            "  return 0; " +
            "else " +
            "  redis.call('INCR', key); " +
            "  return 1; " +
            "end";

    private static final DefaultRedisScript<Long> RATE_LIMIT_SCRIPT = new DefaultRedisScript<>();

    static {
        RATE_LIMIT_SCRIPT.setScriptText(LUA_SCRIPT);
        RATE_LIMIT_SCRIPT.setResultType(Long.class);
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        // 本地/开发环境跳过限流（避免 Windows + Redisson Lua 脚本兼容问题）
        if (Arrays.asList(environment.getActiveProfiles()).contains("local")
                || Arrays.asList(environment.getActiveProfiles()).contains("dev")) {
            return true;
        }

        String clientIp = getClientIp(request);
        String key = "rate_limit:" + clientIp + ":" + request.getRequestURI();
        int limit = 100;
        int windowSeconds = 60;

        List<String> keys = Collections.singletonList(key);
        Long result = stringRedisTemplate.execute(RATE_LIMIT_SCRIPT, keys,
                String.valueOf(limit), String.valueOf(windowSeconds));

        if (result == null || result == 0L) {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            log.warn("Rate limit exceeded for IP: {}, URI: {}", clientIp, request.getRequestURI());
            return false;
        }
        return true;
    }

    private String getClientIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("Proxy-Client-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("WL-Proxy-Client-IP");
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
