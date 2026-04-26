package com.agenthive.auth.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

/**
 * SpringDoc OpenAPI 配置
 */
@Configuration
public class SwaggerConfig {

    @Value("${server.port:8081}")
    private String serverPort;

    @Bean
    public OpenAPI authServiceOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("AgentHive Auth Service API")
                        .description("认证与授权服务接口文档")
                        .version("v1.0.0")
                        .contact(new Contact()
                                .name("AgentHive Team")
                                .url("https://agenthive.cloud")))
                .servers(List.of(
                        new Server().url("http://localhost:" + serverPort).description("本地开发环境"),
                        new Server().url("http://localhost:8080/api/auth").description("Gateway 代理地址")
                ));
    }
}
