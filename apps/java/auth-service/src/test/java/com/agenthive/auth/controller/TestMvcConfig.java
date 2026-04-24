package com.agenthive.auth.controller;

import com.agenthive.common.web.advice.GlobalExceptionHandler;
import com.agenthive.common.web.advice.GlobalResponseAdvice;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.test.context.TestPropertySource;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

@TestConfiguration
@org.springframework.boot.SpringBootConfiguration
@EnableWebMvc
@Import({
    GlobalExceptionHandler.class,
    GlobalResponseAdvice.class
})
@TestPropertySource(properties = {
    "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration," +
    "org.springframework.boot.autoconfigure.security.servlet.SecurityFilterAutoConfiguration," +
    "org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration"
})
public class TestMvcConfig {

    @Bean
    public SecurityFilterChain testSecurityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .authorizeHttpRequests(auth -> auth.anyRequest().permitAll());
        return http.build();
    }
}
