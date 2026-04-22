package com.agenthive.payment.feign;

import com.agenthive.payment.internal.common.Result;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.Map;

@FeignClient(name = "order-service", url = "${order-service.url:http://localhost:8084}")
public interface OrderFeignClient {

    @GetMapping("/orders/{orderNo}")
    Result<Map<String, Object>> getOrder(@PathVariable("orderNo") String orderNo);
}
