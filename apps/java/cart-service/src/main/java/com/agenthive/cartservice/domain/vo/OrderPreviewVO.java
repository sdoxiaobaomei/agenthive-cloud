package com.agenthive.cartservice.domain.vo;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class OrderPreviewVO {

    private Long userId;
    private List<PreviewItem> items;
    private Integer totalQuantity;
    private BigDecimal totalAmount;
    private BigDecimal discountAmount;
    private BigDecimal payableAmount;

    @Data
    public static class PreviewItem {
        private Long productId;
        private Long skuId;
        private String productName;
        private Integer quantity;
        private BigDecimal unitPrice;
        private BigDecimal totalPrice;
    }
}
