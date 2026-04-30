package com.agenthive.gateway.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.cloud.gateway.config.GlobalCorsProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.reactive.CorsWebFilter;
import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource;

/**
 * CORS configuration using CorsWebFilter to apply global CORS settings
 * to all requests (including actuator endpoints and proxied routes).
 *
 * <p>CORS configuration is externalized to K8s ConfigMap via
 * {@code SPRING_CONFIG_ADDITIONAL_LOCATION} — never baked into the image.
 * This bean is only created when external CORS configuration is present.
 */
@Configuration
public class CorsConfig {

    @Bean
    @ConditionalOnProperty(prefix = "spring.cloud.gateway.globalcors", name = "cors-configurations")
    public CorsWebFilter corsWebFilter(GlobalCorsProperties globalCorsProperties) {
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        globalCorsProperties.getCorsConfigurations()
                .forEach(source::registerCorsConfiguration);
        return new CorsWebFilter(source);
    }
}
