package com.agenthive.common.redis.aspect;

import com.agenthive.common.redis.annotation.CacheableExt;
import com.agenthive.common.redis.annotation.CacheEvictExt;
import com.agenthive.common.core.util.JsonUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Aspect
@Component
@RequiredArgsConstructor
public class CacheAspect {

    private final StringRedisTemplate stringRedisTemplate;

    @Around("@annotation(cacheableExt)")
    public Object aroundCacheable(ProceedingJoinPoint point, CacheableExt cacheableExt) throws Throwable {
        String key = cacheableExt.key();
        String cached = stringRedisTemplate.opsForValue().get(key);
        if (cached != null) {
            Class<?> returnType = ((org.aspectj.lang.reflect.MethodSignature) point.getSignature()).getReturnType();
            return JsonUtils.fromJson(cached, returnType);
        }
        Object result = point.proceed();
        if (result != null) {
            stringRedisTemplate.opsForValue().set(key, JsonUtils.toJson(result),
                    cacheableExt.ttl(), cacheableExt.unit());
        }
        return result;
    }

    @Around("@annotation(cacheEvictExt)")
    public Object aroundCacheEvict(ProceedingJoinPoint point, CacheEvictExt cacheEvictExt) throws Throwable {
        String key = cacheEvictExt.key();
        Object result = point.proceed();
        stringRedisTemplate.delete(key);
        return result;
    }
}
