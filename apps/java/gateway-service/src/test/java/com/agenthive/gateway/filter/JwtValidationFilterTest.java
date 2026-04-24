package com.agenthive.gateway.filter;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import javax.crypto.SecretKey;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("JwtValidationFilter JWT 验证过滤器测试")
class JwtValidationFilterTest {

    private static final String TEST_SECRET = "gateway-test-secret-key-min-32-characters-long";
    private static final SecretKey KEY = Keys.hmacShaKeyFor(TEST_SECRET.getBytes(StandardCharsets.UTF_8));

    @InjectMocks
    private JwtValidationFilter jwtValidationFilter;

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
        ReflectionTestUtils.setField(jwtValidationFilter, "jwtSecret", TEST_SECRET);
        ServerWebExchange.Builder exchangeBuilder = mock(ServerWebExchange.Builder.class);
        lenient().when(exchange.getRequest()).thenReturn(request);
        lenient().when(exchange.getResponse()).thenReturn(response);
        lenient().when(exchange.mutate()).thenReturn(exchangeBuilder);
        lenient().when(exchangeBuilder.request(any(ServerHttpRequest.class))).thenReturn(exchangeBuilder);
        lenient().when(exchangeBuilder.build()).thenReturn(mutatedExchange);
        lenient().when(request.mutate()).thenReturn(requestBuilder);
        lenient().when(requestBuilder.header(anyString(), anyString())).thenReturn(requestBuilder);
        lenient().when(requestBuilder.build()).thenReturn(request);
    }

    @Test
    @DisplayName("白名单路径应直接放行")
    void filter_shouldBypassWhiteListedPaths() {
        String[] whiteListedPaths = {
                "/api/auth/register",
                "/api/auth/login",
                "/api/auth/refresh",
                "/api/health",
                "/actuator/health",
                "/api/demo/hello"
        };

        for (String path : whiteListedPaths) {
            mockRequestPath(path);
            when(chain.filter(exchange)).thenReturn(Mono.empty());

            StepVerifier.create(jwtValidationFilter.filter(exchange, chain))
                    .verifyComplete();

            verify(chain, atLeastOnce()).filter(exchange);
            verify(response, never()).setStatusCode(any());
        }
    }

    @Test
    @DisplayName("缺少 Authorization 头时应返回 401")
    void filter_shouldReturn401_whenAuthorizationHeaderMissing() {
        mockRequestPath("/api/agents/list");
        HttpHeaders headers = new HttpHeaders();
        when(request.getHeaders()).thenReturn(headers);
        when(response.setComplete()).thenReturn(Mono.empty());

        StepVerifier.create(jwtValidationFilter.filter(exchange, chain))
                .verifyComplete();

        verify(response).setStatusCode(HttpStatus.UNAUTHORIZED);
        verify(chain, never()).filter(any());
    }

    @Test
    @DisplayName("Authorization 格式不是 Bearer 时应返回 401")
    void filter_shouldReturn401_whenAuthorizationFormatInvalid() {
        mockRequestPath("/api/tasks/123");
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Basic dXNlcjpwYXNz");
        when(request.getHeaders()).thenReturn(headers);
        when(response.setComplete()).thenReturn(Mono.empty());

        StepVerifier.create(jwtValidationFilter.filter(exchange, chain))
                .verifyComplete();

        verify(response).setStatusCode(HttpStatus.UNAUTHORIZED);
    }

    @Test
    @DisplayName("有效 token 应放行并转发用户上下文头")
    void filter_shouldAllowRequest_andForwardUserContext_forValidToken() {
        mockRequestPath("/api/projects");
        String token = generateValidToken("user-42", "alice", "ADMIN,USER");
        mockAuthorizationHeader("Bearer " + token);
        when(chain.filter(any(ServerWebExchange.class))).thenReturn(Mono.empty());

        StepVerifier.create(jwtValidationFilter.filter(exchange, chain))
                .verifyComplete();

        ArgumentCaptor<String> headerValueCaptor = ArgumentCaptor.forClass(String.class);
        verify(requestBuilder).header(eq("X-User-Id"), headerValueCaptor.capture());
        verify(requestBuilder).header(eq("X-User-Name"), headerValueCaptor.capture());
        verify(requestBuilder).header(eq("X-User-Role"), headerValueCaptor.capture());

        assertThat(headerValueCaptor.getAllValues())
                .containsExactly("user-42", "alice", "ADMIN,USER");
        verify(chain).filter(any());
    }

    @Test
    @DisplayName("过期 token 应返回 401")
    void filter_shouldReturn401_forExpiredToken() {
        mockRequestPath("/api/chat");
        String expiredToken = generateExpiredToken("user-99");
        mockAuthorizationHeader("Bearer " + expiredToken);
        when(response.setComplete()).thenReturn(Mono.empty());

        StepVerifier.create(jwtValidationFilter.filter(exchange, chain))
                .verifyComplete();

        verify(response).setStatusCode(HttpStatus.UNAUTHORIZED);
        verify(chain, never()).filter(any());
    }

    @Test
    @DisplayName("签名错误的 token 应返回 401")
    void filter_shouldReturn401_forTamperedToken() {
        mockRequestPath("/api/code/files");
        mockAuthorizationHeader("Bearer invalid.token.here");
        when(response.setComplete()).thenReturn(Mono.empty());

        StepVerifier.create(jwtValidationFilter.filter(exchange, chain))
                .verifyComplete();

        verify(response).setStatusCode(HttpStatus.UNAUTHORIZED);
    }

    @Test
    @DisplayName("getOrder 应返回 -100")
    void getOrder_shouldReturnMinus100() {
        assertThat(jwtValidationFilter.getOrder()).isEqualTo(-100);
    }

    private void mockRequestPath(String path) {
        URI uri = URI.create("http://localhost:8080" + path);
        when(request.getURI()).thenReturn(uri);
    }

    private void mockAuthorizationHeader(String value) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", value);
        when(request.getHeaders()).thenReturn(headers);
    }

    private String generateValidToken(String subject, String username, String roles) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + 3600000);
        return Jwts.builder()
                .subject(subject)
                .claim("username", username)
                .claim("roles", roles)
                .issuedAt(now)
                .expiration(expiry)
                .signWith(KEY)
                .compact();
    }

    private String generateExpiredToken(String subject) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() - 1000);
        return Jwts.builder()
                .subject(subject)
                .issuedAt(new Date(now.getTime() - 2000))
                .expiration(expiry)
                .signWith(KEY)
                .compact();
    }
}
