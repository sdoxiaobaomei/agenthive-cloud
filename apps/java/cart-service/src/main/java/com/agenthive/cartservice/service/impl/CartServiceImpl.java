package com.agenthive.cartservice.service.impl;

import com.agenthive.cartservice.domain.dto.AddCartItemRequest;
import com.agenthive.cartservice.domain.dto.CheckoutRequest;
import com.agenthive.cartservice.domain.dto.UpdateCartItemRequest;
import com.agenthive.cartservice.domain.entity.CartItem;
import com.agenthive.cartservice.domain.vo.CartItemVO;
import com.agenthive.cartservice.domain.vo.CartVO;
import com.agenthive.cartservice.domain.vo.OrderPreviewVO;
import com.agenthive.cartservice.internal.common.BaseException;
import com.agenthive.cartservice.mapper.CartItemMapper;
import com.agenthive.cartservice.mq.CartEventPublisher;
import com.agenthive.cartservice.service.CartService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.HashOperations;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.math.RoundingMode;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class CartServiceImpl implements CartService {

    private static final String CART_KEY_PREFIX = "cart:";
    private static final long CART_TTL_SECONDS = 3600;

    private final CartItemMapper cartItemMapper;
    private final RedisTemplate<String, Object> redisTemplate;
    private final CartEventPublisher eventPublisher;
    private final ObjectMapper objectMapper;

    @Override
    public CartVO getCart(Long userId) {
        List<CartItemVO> items = getItemsFromCache(userId);
        if (items == null) {
            items = loadItemsFromDb(userId);
            writeItemsToCache(userId, items);
        }
        return buildCartVO(userId, items);
    }

    @Override
    @Transactional
    public CartItemVO addItem(AddCartItemRequest request) {
        CartItem existing = cartItemMapper.selectByUserAndSku(
                request.getUserId(), request.getProductId(), request.getSkuId());

        CartItem item;
        if (existing != null) {
            existing.setQuantity(existing.getQuantity() + request.getQuantity());
            existing.setSelected(request.getSelected() != null ? request.getSelected() : existing.getSelected());
            existing.setUpdatedAt(LocalDateTime.now());
            cartItemMapper.updateById(existing);
            item = existing;
        } else {
            item = new CartItem();
            item.setUserId(request.getUserId());
            item.setProductId(request.getProductId());
            item.setSkuId(request.getSkuId());
            item.setQuantity(request.getQuantity());
            item.setSelected(request.getSelected() != null ? request.getSelected() : true);
            item.setCreatedAt(LocalDateTime.now());
            item.setUpdatedAt(LocalDateTime.now());
            cartItemMapper.insert(item);
        }

        invalidateCache(request.getUserId());
        eventPublisher.publishCartUpdated(request.getUserId());
        return toVO(item);
    }

    @Override
    @Transactional
    public CartItemVO updateItem(Long id, UpdateCartItemRequest request) {
        CartItem item = cartItemMapper.selectById(id);
        if (item == null) {
            throw new BaseException(404, "Cart item not found");
        }

        LambdaUpdateWrapper<CartItem> updateWrapper = new LambdaUpdateWrapper<>();
        updateWrapper.eq(CartItem::getId, id);

        if (request.getQuantity() != null) {
            updateWrapper.set(CartItem::getQuantity, request.getQuantity());
        }
        if (request.getSelected() != null) {
            updateWrapper.set(CartItem::getSelected, request.getSelected());
        }
        updateWrapper.set(CartItem::getUpdatedAt, LocalDateTime.now());

        cartItemMapper.update(updateWrapper);
        CartItem updated = cartItemMapper.selectById(id);

        invalidateCache(updated.getUserId());
        eventPublisher.publishCartUpdated(updated.getUserId());
        return toVO(updated);
    }

    @Override
    @Transactional
    public void deleteItem(Long id) {
        CartItem item = cartItemMapper.selectById(id);
        if (item == null) {
            throw new BaseException(404, "Cart item not found");
        }
        cartItemMapper.deleteById(id);
        invalidateCache(item.getUserId());
        eventPublisher.publishCartUpdated(item.getUserId());
    }

    @Override
    @Transactional
    public void clearCart(Long userId) {
        LambdaQueryWrapper<CartItem> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(CartItem::getUserId, userId);
        cartItemMapper.delete(wrapper);
        invalidateCache(userId);
        eventPublisher.publishCartUpdated(userId);
    }

    @Override
    public OrderPreviewVO checkout(CheckoutRequest request) {
        Long userId = request.getUserId();
        List<CartItemVO> items = getCart(userId).getItems();

        if (CollectionUtils.isEmpty(items)) {
            throw new BaseException(400, "Cart is empty");
        }

        List<CartItemVO> selectedItems;
        if (!CollectionUtils.isEmpty(request.getSelectedItemIds())) {
            selectedItems = items.stream()
                    .filter(i -> request.getSelectedItemIds().contains(i.getId()))
                    .filter(CartItemVO::getSelected)
                    .collect(Collectors.toList());
        } else {
            selectedItems = items.stream()
                    .filter(CartItemVO::getSelected)
                    .collect(Collectors.toList());
        }

        if (CollectionUtils.isEmpty(selectedItems)) {
            throw new BaseException(400, "No items selected for checkout");
        }

        // Validate stock (mock: always available for demo)
        // In production, this would call inventory-service
        for (CartItemVO item : selectedItems) {
            if (item.getQuantity() <= 0) {
                throw new BaseException(400, "Invalid quantity for product " + item.getProductId());
            }
        }

        OrderPreviewVO preview = new OrderPreviewVO();
        preview.setUserId(userId);
        preview.setTotalQuantity(selectedItems.stream().mapToInt(CartItemVO::getQuantity).sum());

        List<OrderPreviewVO.PreviewItem> previewItems = new ArrayList<>();
        BigDecimal totalAmount = BigDecimal.ZERO;

        for (CartItemVO item : selectedItems) {
            // Mock price based on productId for demo
            BigDecimal unitPrice = mockPrice(item.getProductId());
            BigDecimal itemTotal = unitPrice.multiply(BigDecimal.valueOf(item.getQuantity()));
            totalAmount = totalAmount.add(itemTotal);

            OrderPreviewVO.PreviewItem pi = new OrderPreviewVO.PreviewItem();
            pi.setProductId(item.getProductId());
            pi.setSkuId(item.getSkuId());
            pi.setProductName("Product-" + item.getProductId());
            pi.setQuantity(item.getQuantity());
            pi.setUnitPrice(unitPrice);
            pi.setTotalPrice(itemTotal);
            previewItems.add(pi);
        }

        preview.setItems(previewItems);
        preview.setTotalAmount(totalAmount);
        // Mock discount for demo
        BigDecimal discount = totalAmount.compareTo(BigDecimal.valueOf(100)) >= 0
                ? totalAmount.multiply(BigDecimal.valueOf(0.05))
                : BigDecimal.ZERO;
        preview.setDiscountAmount(discount.setScale(2, RoundingMode.HALF_UP));
        preview.setPayableAmount(totalAmount.subtract(preview.getDiscountAmount()).setScale(2, RoundingMode.HALF_UP));

        return preview;
    }

    private List<CartItemVO> getItemsFromCache(Long userId) {
        String key = CART_KEY_PREFIX + userId;
        HashOperations<String, String, String> hashOps = getStringHashOps();
        Map<String, String> entries = hashOps.entries(key);
        if (CollectionUtils.isEmpty(entries)) {
            return null;
        }
        List<CartItemVO> items = new ArrayList<>();
        for (String json : entries.values()) {
            try {
                CartItemVO vo = objectMapper.readValue(json, CartItemVO.class);
                items.add(vo);
            } catch (JsonProcessingException e) {
                log.warn("Failed to deserialize cart item from cache", e);
            }
        }
        return items;
    }

    private List<CartItemVO> loadItemsFromDb(Long userId) {
        List<CartItem> entities = cartItemMapper.selectByUserId(userId);
        return entities.stream().map(this::toVO).collect(Collectors.toList());
    }

    private void writeItemsToCache(Long userId, List<CartItemVO> items) {
        String key = CART_KEY_PREFIX + userId;
        HashOperations<String, String, String> hashOps = getStringHashOps();
        redisTemplate.delete(key);
        if (CollectionUtils.isEmpty(items)) {
            return;
        }
        for (CartItemVO item : items) {
            String field = buildHashField(item.getProductId(), item.getSkuId());
            try {
                String value = objectMapper.writeValueAsString(item);
                hashOps.put(key, field, value);
            } catch (JsonProcessingException e) {
                log.warn("Failed to serialize cart item to cache", e);
            }
        }
        redisTemplate.expire(key, CART_TTL_SECONDS, TimeUnit.SECONDS);
    }

    private void invalidateCache(Long userId) {
        String key = CART_KEY_PREFIX + userId;
        redisTemplate.delete(key);
    }

    private CartVO buildCartVO(Long userId, List<CartItemVO> items) {
        CartVO vo = new CartVO();
        vo.setUserId(userId);
        vo.setItems(items != null ? items : new ArrayList<>());
        vo.setTotalCount(items != null ? items.size() : 0);
        vo.setSelectedCount(items != null ? (int) items.stream().filter(CartItemVO::getSelected).count() : 0);
        // Mock total price calculation for display
        BigDecimal totalPrice = BigDecimal.ZERO;
        if (items != null) {
            for (CartItemVO item : items) {
                if (Boolean.TRUE.equals(item.getSelected())) {
                    totalPrice = totalPrice.add(
                            mockPrice(item.getProductId()).multiply(BigDecimal.valueOf(item.getQuantity())));
                }
            }
        }
        vo.setTotalPrice(totalPrice.setScale(2, RoundingMode.HALF_UP));
        return vo;
    }

    private CartItemVO toVO(CartItem entity) {
        if (entity == null) return null;
        CartItemVO vo = new CartItemVO();
        vo.setId(entity.getId());
        vo.setUserId(entity.getUserId());
        vo.setProductId(entity.getProductId());
        vo.setSkuId(entity.getSkuId());
        vo.setQuantity(entity.getQuantity());
        vo.setSelected(entity.getSelected());
        vo.setCreatedAt(entity.getCreatedAt());
        vo.setUpdatedAt(entity.getUpdatedAt());
        return vo;
    }

    private String buildHashField(Long productId, Long skuId) {
        return productId + ":" + (skuId != null ? skuId : "0");
    }

    @SuppressWarnings("unchecked")
    private HashOperations<String, String, String> getStringHashOps() {
        return (HashOperations<String, String, String>) (HashOperations<?, ?, ?>) redisTemplate.opsForHash();
    }

    private BigDecimal mockPrice(Long productId) {
        // Deterministic mock price for demo
        long seed = productId != null ? productId : 1L;
        return BigDecimal.valueOf((seed % 100) + 10).setScale(2, RoundingMode.HALF_UP);
    }
}
