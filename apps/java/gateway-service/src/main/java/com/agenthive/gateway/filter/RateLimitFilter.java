package com.agenthive.gateway.filter;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.util.Collections;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class RateLimitFilter implements GlobalFilter, Ordered {

    private final ReactiveStringRedisTemplate reactiveStringRedisTemplate;

    private static final String RATE_LIMIT_SCRIPT =
            "local key = KEYS[1];" +
            "local limit = tonumber(ARGV[1]);" +
            "local window = tonumber(ARGV[2]);" +
            "local current = redis.call('GET', key);" +
            "if current == false then" +
            "  redis.call('SET', key, 1, 'EX', window);" +
            "  return 1;" +
            "end;" +
            "local count = tonumber(current);" +
            "if count >= limit then" +
            "  return 0;" +
            "else" +
            "  redis.call('INCR', key);" +
            "  redis.call('EXPIRE', key, window);" +
            "  return 1;" +
            "end";

    private static final RedisScript<Long> SCRIPT = RedisScript.of(RATE_LIMIT_SCRIPT, Long.class);

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String clientIp = getClientIp(request);
        String key = "gateway:rate:" + clientIp;
        int limit = 200;
        int window = 60;

        return reactiveStringRedisTemplate.execute(SCRIPT, Collections.singletonList(key),
                        List.of(String.valueOf(limit), String.valueOf(window)))
                .next()
                .flatMap(result -> {
                    if (result == null || result == 0L) {
                        ServerHttpResponse response = exchange.getResponse();
                        response.setStatusCode(HttpStatus.TOO_MANY_REQUESTS);
                        log.warn("Rate limit exceeded for IP: {}", clientIp);
                        return response.setComplete();
                    }
                    return chain.filter(exchange);
                });
    }

    private String getClientIp(ServerHttpRequest request) {
        String ip = request.getHeaders().getFirst("X-Forwarded-For");
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeaders().getFirst("Proxy-Client-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddress() != null ? request.getRemoteAddress().getAddress().getHostAddress() : "unknown";
        }
        if (ip != null && ip.contains(",")) {
            ip = ip.split(",")[0].trim();
        }
        return ip;
    }

    @Override
    public int getOrder() {
        return -50;
    }
}
