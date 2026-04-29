package com.agenthive.order.controller;

import com.agenthive.common.core.result.PageResult;
import com.agenthive.common.core.result.Result;
import com.agenthive.order.domain.enums.ProductStatus;
import com.agenthive.order.domain.vo.CreatorDashboardVO;
import com.agenthive.order.domain.vo.CreatorEarningVO;
import com.agenthive.order.domain.vo.CreatorProductVO;
import com.agenthive.order.service.CreatorService;
import com.agenthive.order.service.dto.PublishProductRequest;
import com.agenthive.order.service.dto.UpdateProductRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/creator")
@RequiredArgsConstructor
public class CreatorController {

    private final CreatorService creatorService;

    @PostMapping("/products")
    public Result<CreatorProductVO> publishProduct(
            @RequestHeader("X-User-Id") Long userId,
            @Valid @RequestBody PublishProductRequest request) {
        return Result.success(creatorService.publishProduct(userId, request));
    }

    @PutMapping("/products/{productId}")
    public Result<CreatorProductVO> updateProduct(
            @RequestHeader("X-User-Id") Long userId,
            @PathVariable Long productId,
            @RequestBody UpdateProductRequest request) {
        return Result.success(creatorService.updateProduct(userId, productId, request));
    }

    @PutMapping("/products/{productId}/status")
    public Result<Void> toggleProductStatus(
            @RequestHeader("X-User-Id") Long userId,
            @PathVariable Long productId,
            @RequestParam ProductStatus status) {
        creatorService.toggleProductStatus(userId, productId, status);
        return Result.success();
    }

    @DeleteMapping("/products/{productId}")
    public Result<Void> deleteProduct(
            @RequestHeader("X-User-Id") Long userId,
            @PathVariable Long productId) {
        creatorService.deleteProduct(userId, productId);
        return Result.success();
    }

    @GetMapping("/products/{productId}")
    public Result<CreatorProductVO> getProduct(@PathVariable Long productId) {
        return Result.success(creatorService.getProduct(productId));
    }

    @GetMapping("/products")
    public Result<List<CreatorProductVO>> listMyProducts(
            @RequestHeader("X-User-Id") Long userId,
            @RequestParam(required = false) ProductStatus status) {
        return Result.success(creatorService.listMyProducts(userId, status));
    }

    @GetMapping("/dashboard")
    public Result<CreatorDashboardVO> getDashboard(@RequestHeader("X-User-Id") Long userId) {
        return Result.success(creatorService.getDashboard(userId));
    }

    @GetMapping("/earnings")
    public Result<PageResult<CreatorEarningVO>> listEarnings(
            @RequestHeader("X-User-Id") Long userId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(defaultValue = "1") long page,
            @RequestParam(defaultValue = "20") long size) {
        return Result.success(creatorService.listEarnings(userId, startDate, endDate, page, size));
    }
}
