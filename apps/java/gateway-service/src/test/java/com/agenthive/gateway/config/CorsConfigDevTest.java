package com.agenthive.gateway.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.reactive.AutoConfigureWebTestClient;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.reactive.server.WebTestClient;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("dev")
@AutoConfigureWebTestClient
@TestPropertySource(properties = {
    "spring.cloud.nacos.discovery.enabled=false",
    "spring.cloud.nacos.config.enabled=false",
    "spring.cloud.nacos.config.import-check.enabled=false",
    "spring.data.redis.host=localhost",
    "spring.data.redis.password=dummy",
    "jwt.secret=test-jwt-key-min-32-characters-long-for-gateway-tests-only",
    "management.health.redis.enabled=false"
})
@DisplayName("CORS 开发环境配置集成测试")
class CorsConfigDevTest {

    @Autowired
    private WebTestClient webTestClient;

    @Test
    @DisplayName("OPTIONS 预检请求：localhost:3000 返回完整 CORS 头")
    void preflight_localhost3000_returnsCorsHeaders() {
        webTestClient.options()
                .uri("/actuator/health")
                .header(HttpHeaders.ORIGIN, "http://localhost:3000")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, HttpMethod.GET.name())
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "Authorization, Content-Type")
                .exchange()
                .expectStatus().isOk()
                .expectHeader().valueEquals(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:3000")
                .expectHeader().valueEquals(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS, "true")
                .expectHeader().value(HttpHeaders.ACCESS_CONTROL_ALLOW_METHODS, methods ->
                        assertThat(methods).contains("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"))
                .expectHeader().value(HttpHeaders.ACCESS_CONTROL_ALLOW_HEADERS, headers ->
                        assertThat(headers).contains("Content-Type", "Authorization"));
    }

    @Test
    @DisplayName("OPTIONS 预检请求：localhost:3001 返回完整 CORS 头")
    void preflight_localhost3001_returnsCorsHeaders() {
        webTestClient.options()
                .uri("/actuator/health")
                .header(HttpHeaders.ORIGIN, "http://localhost:3001")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, HttpMethod.POST.name())
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "Authorization")
                .exchange()
                .expectStatus().isOk()
                .expectHeader().valueEquals(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:3001")
                .expectHeader().valueEquals(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS, "true");
    }

    @Test
    @DisplayName("OPTIONS 预检请求：生产 Origin 被拒绝")
    void preflight_prodOrigin_rejected() {
        webTestClient.options()
                .uri("/actuator/health")
                .header(HttpHeaders.ORIGIN, "https://agenthive.cloud")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, HttpMethod.GET.name())
                .exchange()
                .expectStatus().isEqualTo(HttpStatus.FORBIDDEN)
                .expectHeader().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN)
                .expectHeader().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS);
    }

    @Test
    @DisplayName("GET 实际请求：合法 Origin 携带 CORS 头")
    void actualRequest_allowedOrigin_returnsCorsHeaders() {
        webTestClient.get()
                .uri("/actuator/health")
                .header(HttpHeaders.ORIGIN, "http://localhost:3000")
                .exchange()
                .expectStatus().isOk()
                .expectHeader().valueEquals(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:3000")
                .expectHeader().valueEquals(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS, "true");
    }

    @Test
    @DisplayName("GET 实际请求：非法 Origin 被拒绝")
    void actualRequest_blockedOrigin_rejected() {
        webTestClient.get()
                .uri("/actuator/health")
                .header(HttpHeaders.ORIGIN, "https://evil.com")
                .exchange()
                .expectStatus().isEqualTo(HttpStatus.FORBIDDEN)
                .expectHeader().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN);
    }
}
