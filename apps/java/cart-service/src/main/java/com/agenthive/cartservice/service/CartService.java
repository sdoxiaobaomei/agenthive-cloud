package com.agenthive.cartservice.service;

import com.agenthive.cartservice.domain.dto.AddCartItemRequest;
import com.agenthive.cartservice.domain.dto.CheckoutRequest;
import com.agenthive.cartservice.domain.dto.UpdateCartItemRequest;
import com.agenthive.cartservice.domain.vo.CartItemVO;
import com.agenthive.cartservice.domain.vo.CartVO;
import com.agenthive.cartservice.domain.vo.OrderPreviewVO;

public interface CartService {

    CartVO getCart(Long userId);

    CartItemVO addItem(AddCartItemRequest request);

    CartItemVO updateItem(Long id, UpdateCartItemRequest request);

    void deleteItem(Long id);

    void clearCart(Long userId);

    OrderPreviewVO checkout(CheckoutRequest request);
}
