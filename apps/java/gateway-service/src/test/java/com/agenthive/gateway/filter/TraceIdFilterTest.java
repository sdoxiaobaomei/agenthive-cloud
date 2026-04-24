package com.agenthive.gateway.filter;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.http.HttpHeaders;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("TraceIdFilter 链路追踪过滤器测试")
class TraceIdFilterTest {

    @InjectMocks
    private TraceIdFilter traceIdFilter;

    @Mock
    private ServerWebExchange exchange;

    @Mock
    private ServerWebExchange mutatedExchange;

    @Mock
    private ServerHttpRequest request;

    @Mock
    private ServerHttpRequest.Builder requestBuilder;

    @Mock
    private ServerHttpResponse response;

    @Mock
    private GatewayFilterChain chain;

    @BeforeEach
    void setUp() {
        ServerWebExchange.Builder exchangeBuilder = mock(ServerWebExchange.Builder.class);
        when(exchange.getRequest()).thenReturn(request);
        when(exchange.getResponse()).thenReturn(response);
        when(exchange.mutate()).thenReturn(exchangeBuilder);
        when(exchangeBuilder.request(any(ServerHttpRequest.class))).thenReturn(exchangeBuilder);
        when(exchangeBuilder.build()).thenReturn(mutatedExchange);
        when(request.mutate()).thenReturn(requestBuilder);
        when(requestBuilder.header(anyString(), anyString())).thenReturn(requestBuilder);
        when(requestBuilder.build()).thenReturn(request);
        when(response.getHeaders()).thenReturn(new HttpHeaders());
        when(response.isCommitted()).thenReturn(false);
    }

    @Test
    @DisplayName("当请求头中不存在 trace-id 时应生成新的 UUID")
    void filter_shouldGenerateNewTraceId_whenHeaderMissing() {
        HttpHeaders headers = new HttpHeaders();
        when(request.getHeaders()).thenReturn(headers);
        when(chain.filter(any(ServerWebExchange.class))).thenReturn(Mono.empty());

        StepVerifier.create(traceIdFilter.filter(exchange, chain))
                .verifyComplete();

        ArgumentCaptor<String> traceIdCaptor = ArgumentCaptor.forClass(String.class);
        verify(requestBuilder).header(eq(TraceIdFilter.TRACE_ID_HEADER), traceIdCaptor.capture());
        String generatedTraceId = traceIdCaptor.getValue();
        assertThat(generatedTraceId)
                .isNotBlank()
                .doesNotContain("-")
                .hasSize(32);
    }

    @Test
    @DisplayName("当请求头中已存在 trace-id 时应透传该值")
    void filter_shouldPropagateExistingTraceId_whenHeaderPresent() {
        String existingTraceId = "a1b2c3d4e5f6789012345678abcdef01";
        HttpHeaders headers = new HttpHeaders();
        headers.set(TraceIdFilter.TRACE_ID_HEADER, existingTraceId);
        when(request.getHeaders()).thenReturn(headers);
        when(chain.filter(any(ServerWebExchange.class))).thenReturn(Mono.empty());

        StepVerifier.create(traceIdFilter.filter(exchange, chain))
                .verifyComplete();

        verify(requestBuilder).header(TraceIdFilter.TRACE_ID_HEADER, existingTraceId);
    }

    @Test
    @DisplayName("getOrder 应返回最高优先级 -200")
    void getOrder_shouldReturnHighestPrecedence() {
        assertThat(traceIdFilter.getOrder()).isEqualTo(-200);
    }
}
