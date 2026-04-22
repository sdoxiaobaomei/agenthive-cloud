package com.agenthive.order.service;

import com.agenthive.order.domain.vo.OrderVO;
import com.agenthive.order.internal.common.PageResult;
import com.agenthive.order.service.dto.CreateOrderRequest;

public interface OrderService {
    OrderVO createOrder(CreateOrderRequest request);
    OrderVO getOrder(String orderNo);
    PageResult<OrderVO> getUserOrders(Long userId, long page, long size);
    void cancelOrder(String orderNo);
    void confirmOrder(String orderNo);
}
