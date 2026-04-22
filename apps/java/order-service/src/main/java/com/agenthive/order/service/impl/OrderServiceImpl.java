package com.agenthive.order.service.impl;

import com.agenthive.order.domain.entity.Order;
import com.agenthive.order.domain.entity.OrderItem;
import com.agenthive.order.domain.enums.OrderStatus;
import com.agenthive.order.domain.vo.OrderItemVO;
import com.agenthive.order.domain.vo.OrderVO;
import com.agenthive.order.internal.common.BusinessException;
import com.agenthive.order.internal.common.PageResult;
import com.agenthive.order.internal.common.SnowflakeIdGenerator;
import com.agenthive.order.mapper.OrderItemMapper;
import com.agenthive.order.mapper.OrderMapper;
import com.agenthive.order.mq.OrderMqProducer;
import com.agenthive.order.service.OrderService;
import com.agenthive.order.service.dto.CreateOrderRequest;
import com.agenthive.order.service.dto.OrderItemRequest;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderServiceImpl implements OrderService {

    private final OrderMapper orderMapper;
    private final OrderItemMapper orderItemMapper;
    private final SnowflakeIdGenerator idGenerator;
    private final OrderMqProducer mqProducer;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public OrderVO createOrder(CreateOrderRequest request) {
        String orderNo = "ORD" + idGenerator.nextIdStr();
        BigDecimal totalAmount = BigDecimal.ZERO;

        List<OrderItem> orderItems = new ArrayList<>();
        List<Map<String, Object>> itemMessages = new ArrayList<>();

        for (OrderItemRequest itemReq : request.getItems()) {
            BigDecimal itemTotal = itemReq.getUnitPrice().multiply(new BigDecimal(itemReq.getQuantity()));
            totalAmount = totalAmount.add(itemTotal);

            OrderItem item = new OrderItem();
            item.setProductId(itemReq.getProductId());
            item.setProductName(itemReq.getProductName());
            item.setSkuId(itemReq.getSkuId());
            item.setQuantity(itemReq.getQuantity());
            item.setUnitPrice(itemReq.getUnitPrice());
            item.setTotalPrice(itemTotal);
            orderItems.add(item);

            Map<String, Object> msg = new HashMap<>();
            msg.put("productId", itemReq.getProductId());
            msg.put("quantity", itemReq.getQuantity());
            msg.put("unitPrice", itemReq.getUnitPrice());
            itemMessages.add(msg);
        }

        Order order = new Order();
        order.setOrderNo(orderNo);
        order.setUserId(request.getUserId());
        order.setTotalAmount(totalAmount);
        order.setStatus(OrderStatus.CREATED);
        order.setPayStatus("UNPAID");
        order.setLogisticsStatus("PENDING");
        order.setCreatedAt(LocalDateTime.now());
        orderMapper.insert(order);

        for (OrderItem item : orderItems) {
            item.setOrderId(order.getId());
            orderItemMapper.insert(item);
        }

        mqProducer.sendOrderCreated(orderNo, request.getUserId(), totalAmount, itemMessages);
        return convertToVO(order, orderItems);
    }

    @Override
    public OrderVO getOrder(String orderNo) {
        Order order = orderMapper.selectByOrderNo(orderNo);
        if (order == null) {
            throw new BusinessException("订单不存在");
        }
        List<OrderItem> items = orderItemMapper.selectByOrderId(order.getId());
        return convertToVO(order, items);
    }

    @Override
    public PageResult<OrderVO> getUserOrders(Long userId, long page, long size) {
        Page<Order> pageParam = new Page<>(page, size);
        orderMapper.selectPage(pageParam, new LambdaQueryWrapper<Order>().eq(Order::getUserId, userId).orderByDesc(Order::getCreatedAt));

        List<OrderVO> records = pageParam.getRecords().stream().map(order -> {
            List<OrderItem> items = orderItemMapper.selectByOrderId(order.getId());
            return convertToVO(order, items);
        }).collect(Collectors.toList());

        return PageResult.of(page, size, pageParam.getTotal(), records);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void cancelOrder(String orderNo) {
        Order order = orderMapper.selectByOrderNo(orderNo);
        if (order == null) {
            throw new BusinessException("订单不存在");
        }
        if (order.getStatus() != OrderStatus.CREATED) {
            throw new BusinessException("只有待支付订单才能取消");
        }
        order.setStatus(OrderStatus.CANCELLED);
        orderMapper.updateById(order);
        mqProducer.sendOrderCancelled(orderNo, order.getUserId());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void confirmOrder(String orderNo) {
        Order order = orderMapper.selectByOrderNo(orderNo);
        if (order == null) {
            throw new BusinessException("订单不存在");
        }
        if (order.getStatus() != OrderStatus.DELIVERED) {
            throw new BusinessException("只有已送达订单才能确认收货");
        }
        order.setStatus(OrderStatus.COMPLETED);
        order.setCompletedAt(LocalDateTime.now());
        orderMapper.updateById(order);
    }

    private OrderVO convertToVO(Order order, List<OrderItem> items) {
        OrderVO vo = new OrderVO();
        vo.setOrderNo(order.getOrderNo());
        vo.setUserId(order.getUserId());
        vo.setTotalAmount(order.getTotalAmount());
        vo.setStatus(order.getStatus());
        vo.setPayStatus(order.getPayStatus());
        vo.setLogisticsStatus(order.getLogisticsStatus());
        vo.setCreatedAt(order.getCreatedAt());
        vo.setPaidAt(order.getPaidAt());
        vo.setShippedAt(order.getShippedAt());
        vo.setDeliveredAt(order.getDeliveredAt());
        vo.setCompletedAt(order.getCompletedAt());
        if (items != null) {
            vo.setItems(items.stream().map(item -> {
                OrderItemVO itemVO = new OrderItemVO();
                itemVO.setProductId(item.getProductId());
                itemVO.setProductName(item.getProductName());
                itemVO.setSkuId(item.getSkuId());
                itemVO.setQuantity(item.getQuantity());
                itemVO.setUnitPrice(item.getUnitPrice());
                itemVO.setTotalPrice(item.getTotalPrice());
                return itemVO;
            }).collect(Collectors.toList()));
        }
        return vo;
    }
}
