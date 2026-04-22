package com.agenthive.user.feign;

import com.agenthive.common.core.result.Result;
import com.agenthive.common.feign.config.FeignConfig;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.List;

@FeignClient(name = "auth-service", configuration = FeignConfig.class, fallback = AuthFeignClientFallback.class)
public interface AuthFeignClient {

    @GetMapping("/auth/users/{id}/roles")
    Result<List<String>> getUserRolesInternal(@PathVariable("id") Long id);

    default List<String> getUserRoles(Long id) {
        Result<List<String>> result = getUserRolesInternal(id);
        return result != null && result.isSuccess() ? result.getData() : List.of();
    }
}
