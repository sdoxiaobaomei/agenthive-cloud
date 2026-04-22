package com.agenthive.gateway.filter;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RateLimitFilterTest {

    @Mock
    private ReactiveStringRedisTemplate reactiveStringRedisTemplate;

    @Mock
    private ServerWebExchange exchange;

    @Mock
    private ServerHttpRequest request;

    @Mock
    private ServerHttpResponse response;

    @Mock
    private GatewayFilterChain chain;

    @InjectMocks
    private RateLimitFilter rateLimitFilter;

    @BeforeEach
    void setUp() {
        lenient().when(exchange.getRequest()).thenReturn(request);
        lenient().when(exchange.getResponse()).thenReturn(response);
    }

    @Test
    void filter_shouldAllowRequest_whenFirstRequest() {
        // Arrange
        mockClientIp("192.168.1.1");
        when(reactiveStringRedisTemplate.execute(any(RedisScript.class), anyList(), anyList()))
                .thenReturn(Flux.just(1L));
        when(chain.filter(exchange)).thenReturn(Mono.empty());

        // Act & Assert
        StepVerifier.create(rateLimitFilter.filter(exchange, chain))
                .verifyComplete();

        verify(chain).filter(exchange);
        verify(response, never()).setStatusCode(any());
    }

    @Test
    void filter_shouldAllowRequest_whenWithinLimit() {
        // Arrange
        mockClientIp("192.168.1.2");
        when(reactiveStringRedisTemplate.execute(any(RedisScript.class), anyList(), anyList()))
                .thenReturn(Flux.just(1L));
        when(chain.filter(exchange)).thenReturn(Mono.empty());

        // Act & Assert
        StepVerifier.create(rateLimitFilter.filter(exchange, chain))
                .verifyComplete();

        verify(chain).filter(exchange);
    }

    @Test
    void filter_shouldReturn429_whenRateLimitExceeded() {
        // Arrange
        mockClientIp("192.168.1.3");
        when(reactiveStringRedisTemplate.execute(any(RedisScript.class), anyList(), anyList()))
                .thenReturn(Flux.just(0L));
        when(response.setComplete()).thenReturn(Mono.empty());

        // Act & Assert
        StepVerifier.create(rateLimitFilter.filter(exchange, chain))
                .verifyComplete();

        verify(response).setStatusCode(HttpStatus.TOO_MANY_REQUESTS);
        verify(response).setComplete();
        verify(chain, never()).filter(exchange);
    }

    @Test
    void filter_shouldExecuteLuaScript_withCorrectParameters() {
        // Arrange
        mockClientIp("10.0.0.1");
        when(reactiveStringRedisTemplate.execute(any(RedisScript.class), anyList(), anyList()))
                .thenReturn(Flux.just(1L));
        when(chain.filter(exchange)).thenReturn(Mono.empty());

        // Act
        rateLimitFilter.filter(exchange, chain).block();

        // Assert
        verify(reactiveStringRedisTemplate).execute(any(RedisScript.class), argThat(list -> {
            assertThat(list).hasSize(1);
            assertThat(list.get(0)).isEqualTo("gateway:rate:10.0.0.1");
            return true;
        }), argThat(list -> {
            assertThat(list).hasSize(2);
            assertThat(list.get(0)).isEqualTo("200");
            assertThat(list.get(1)).isEqualTo("60");
            return true;
        }));
    }

    private void mockClientIp(String ip) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Forwarded-For", ip);
        when(request.getHeaders()).thenReturn(headers);
    }
}
