package com.agenthive.user.feign;

import com.agenthive.common.core.result.Result;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class AuthFeignClientFallback implements AuthFeignClient {

    @Override
    public Result<List<String>> getUserRolesInternal(Long id) {
        return Result.success(List.of());
    }
}
