package com.agenthive.payment.controller;

import com.agenthive.payment.domain.vo.MarketplaceOrderVO;
import com.agenthive.payment.internal.common.Result;
import com.agenthive.payment.service.MarketplaceOrderService;
import com.agenthive.payment.service.dto.CreateOrderRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/marketplace/orders")
@RequiredArgsConstructor
public class MarketplaceOrderController {

    private final MarketplaceOrderService orderService;

    @PostMapping
    public Result<MarketplaceOrderVO> createOrder(@Valid @RequestBody CreateOrderRequest request) {
        return Result.success(orderService.createOrder(request));
    }

    @PostMapping("/{id}/pay")
    public Result<MarketplaceOrderVO> payOrder(@PathVariable Long id, @RequestParam String payChannel) {
        return Result.success(orderService.payOrder(id, payChannel));
    }

    @PostMapping("/{id}/refund")
    public Result<MarketplaceOrderVO> refundOrder(@PathVariable Long id) {
        return Result.success(orderService.refundOrder(id));
    }
}
