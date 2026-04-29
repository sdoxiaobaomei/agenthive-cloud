package com.agenthive.payment.controller;

import com.agenthive.payment.domain.vo.MarketplaceProductVO;
import com.agenthive.payment.internal.common.Result;
import com.agenthive.payment.service.MarketplaceProductService;
import com.agenthive.payment.service.dto.CreateProductRequest;
import com.agenthive.payment.service.dto.ProductQueryRequest;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/marketplace/products")
@RequiredArgsConstructor
public class MarketplaceProductController {

    private final MarketplaceProductService productService;

    @PostMapping
    public Result<MarketplaceProductVO> createProduct(@Valid @RequestBody CreateProductRequest request) {
        return Result.success(productService.createProduct(request));
    }

    @GetMapping
    public Result<Page<MarketplaceProductVO>> getProducts(ProductQueryRequest request) {
        return Result.success(productService.getProducts(request));
    }

    @GetMapping("/{id}")
    public Result<MarketplaceProductVO> getProduct(@PathVariable Long id) {
        return Result.success(productService.getProduct(id));
    }

    @PatchMapping("/{id}")
    public Result<MarketplaceProductVO> updateProduct(@PathVariable Long id, @Valid @RequestBody CreateProductRequest request) {
        return Result.success(productService.updateProduct(id, request));
    }

    @PostMapping("/{id}/deactivate")
    public Result<Void> deactivateProduct(@PathVariable Long id) {
        productService.deactivateProduct(id);
        return Result.success();
    }
}
