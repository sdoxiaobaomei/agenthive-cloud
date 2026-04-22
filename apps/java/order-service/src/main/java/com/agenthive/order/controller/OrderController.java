package com.agenthive.order.controller;

import com.agenthive.order.domain.vo.OrderVO;
import com.agenthive.order.internal.common.PageResult;
import com.agenthive.order.internal.common.Result;
import com.agenthive.order.service.OrderService;
import com.agenthive.order.service.dto.CreateOrderRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    @PostMapping
    public Result<OrderVO> create(@Valid @RequestBody CreateOrderRequest request) {
        return Result.success(orderService.createOrder(request));
    }

    @GetMapping("/{orderNo}")
    public Result<OrderVO> getByOrderNo(@PathVariable String orderNo) {
        return Result.success(orderService.getOrder(orderNo));
    }

    @GetMapping("/user/{userId}")
    public Result<PageResult<OrderVO>> getUserOrders(
            @PathVariable Long userId,
            @RequestParam(defaultValue = "1") long page,
            @RequestParam(defaultValue = "10") long size) {
        return Result.success(orderService.getUserOrders(userId, page, size));
    }

    @PutMapping("/{orderNo}/cancel")
    public Result<Void> cancel(@PathVariable String orderNo) {
        orderService.cancelOrder(orderNo);
        return Result.success();
    }

    @PutMapping("/{orderNo}/confirm")
    public Result<Void> confirm(@PathVariable String orderNo) {
        orderService.confirmOrder(orderNo);
        return Result.success();
    }
}
