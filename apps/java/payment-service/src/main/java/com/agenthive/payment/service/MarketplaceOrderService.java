package com.agenthive.payment.service;

import com.agenthive.payment.domain.vo.MarketplaceOrderVO;
import com.agenthive.payment.service.dto.CreateOrderRequest;

public interface MarketplaceOrderService {

    MarketplaceOrderVO createOrder(CreateOrderRequest request);

    MarketplaceOrderVO payOrder(Long orderId, String payChannel);

    MarketplaceOrderVO refundOrder(Long orderId);
}
