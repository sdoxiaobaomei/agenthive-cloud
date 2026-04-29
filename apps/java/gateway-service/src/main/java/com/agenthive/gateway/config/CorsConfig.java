package com.agenthive.gateway.config;

import org.springframework.cloud.gateway.config.GlobalCorsProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.reactive.CorsWebFilter;
import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource;

/**
 * CORS configuration using CorsWebFilter to apply global CORS settings
 * to all requests (including actuator endpoints and proxied routes).
 *
 * <p>Configuration is loaded from profile-specific YAML files
 * (application-dev.yml, application-prod.yml) via {@link GlobalCorsProperties}.
 * The companion {@link AbsoluteUriFilter} ensures CORS processing works
 * correctly with relative URIs sent by WebTestClient in integration tests.
 */
@Configuration
public class CorsConfig {

    @Bean
    public CorsWebFilter corsWebFilter(GlobalCorsProperties globalCorsProperties) {
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        globalCorsProperties.getCorsConfigurations()
                .forEach(source::registerCorsConfiguration);
        return new CorsWebFilter(source);
    }
}
