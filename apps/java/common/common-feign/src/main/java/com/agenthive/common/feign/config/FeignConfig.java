package com.agenthive.common.feign.config;

import feign.RequestInterceptor;
import feign.RequestTemplate;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Slf4j
@Configuration
public class FeignConfig {

    public static final String TRACE_ID_HEADER = "x-trace-id";
    public static final String AUTHORIZATION_HEADER = "Authorization";

    @Bean
    public RequestInterceptor feignRequestInterceptor() {
        return new RequestInterceptor() {
            @Override
            public void apply(RequestTemplate template) {
                // Propagate trace-id
                String traceId = MDC.get("traceId");
                if (traceId != null) {
                    template.header(TRACE_ID_HEADER, traceId);
                }

                // Propagate JWT token
                ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
                if (attributes != null) {
                    String auth = attributes.getRequest().getHeader(AUTHORIZATION_HEADER);
                    if (auth != null) {
                        template.header(AUTHORIZATION_HEADER, auth);
                    }
                }
            }
        };
    }
}
