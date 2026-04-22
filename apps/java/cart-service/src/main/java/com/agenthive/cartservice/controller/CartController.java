package com.agenthive.cartservice.controller;

import com.agenthive.cartservice.domain.dto.AddCartItemRequest;
import com.agenthive.cartservice.domain.dto.CheckoutRequest;
import com.agenthive.cartservice.domain.dto.UpdateCartItemRequest;
import com.agenthive.cartservice.domain.vo.CartItemVO;
import com.agenthive.cartservice.domain.vo.CartVO;
import com.agenthive.cartservice.domain.vo.OrderPreviewVO;
import com.agenthive.cartservice.internal.common.Result;
import com.agenthive.cartservice.service.CartService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/carts")
@RequiredArgsConstructor
public class CartController {

    private final CartService cartService;

    @GetMapping("/{userId}")
    public Result<CartVO> getCart(@PathVariable Long userId) {
        return Result.success(cartService.getCart(userId));
    }

    @PostMapping("/items")
    public Result<CartItemVO> addItem(@Valid @RequestBody AddCartItemRequest request) {
        return Result.success(cartService.addItem(request));
    }

    @PutMapping("/items/{id}")
    public Result<CartItemVO> updateItem(@PathVariable Long id,
                                         @Valid @RequestBody UpdateCartItemRequest request) {
        return Result.success(cartService.updateItem(id, request));
    }

    @DeleteMapping("/items/{id}")
    public Result<Void> deleteItem(@PathVariable Long id) {
        cartService.deleteItem(id);
        return Result.success();
    }

    @PostMapping("/clear")
    public Result<Void> clearCart(@RequestParam Long userId) {
        cartService.clearCart(userId);
        return Result.success();
    }

    @PostMapping("/checkout")
    public Result<OrderPreviewVO> checkout(@Valid @RequestBody CheckoutRequest request) {
        return Result.success(cartService.checkout(request));
    }
}
