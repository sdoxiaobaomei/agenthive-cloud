package com.agenthive.payment.service;

import com.agenthive.payment.domain.entity.MarketplaceProduct;
import com.agenthive.payment.domain.vo.MarketplaceProductVO;
import com.agenthive.payment.service.dto.CreateProductRequest;
import com.agenthive.payment.service.dto.ProductQueryRequest;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;

public interface MarketplaceProductService {

    MarketplaceProductVO createProduct(CreateProductRequest request);

    Page<MarketplaceProductVO> getProducts(ProductQueryRequest request);

    MarketplaceProductVO getProduct(Long id);

    MarketplaceProductVO updateProduct(Long id, CreateProductRequest request);

    void deactivateProduct(Long id);
}
