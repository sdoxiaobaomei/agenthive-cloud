package com.agenthive.payment.service.impl;

import com.agenthive.payment.domain.entity.MarketplaceProduct;
import com.agenthive.payment.domain.enums.MarketplaceProductStatus;
import com.agenthive.payment.domain.vo.MarketplaceProductVO;
import com.agenthive.payment.internal.common.BusinessException;
import com.agenthive.payment.mapper.MarketplaceProductMapper;
import com.agenthive.payment.service.MarketplaceProductService;
import com.agenthive.payment.service.dto.CreateProductRequest;
import com.agenthive.payment.service.dto.ProductQueryRequest;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class MarketplaceProductServiceImpl implements MarketplaceProductService {

    private final MarketplaceProductMapper productMapper;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public MarketplaceProductVO createProduct(CreateProductRequest request) {
        MarketplaceProduct product = new MarketplaceProduct();
        product.setSellerId(request.getSellerId());
        product.setType(request.getType());
        product.setName(request.getName());
        product.setDescription(request.getDescription());
        product.setPrice(request.getPrice());
        product.setCreditsPrice(request.getCreditsPrice());
        product.setCategory(request.getCategory());
        product.setTags(request.getTags());
        product.setPreviewImages(request.getPreviewImages());
        product.setDemoUrl(request.getDemoUrl());
        product.setStatus(MarketplaceProductStatus.ACTIVE.name());
        product.setSalesCount(0);
        product.setRating(new java.math.BigDecimal("5.0"));
        product.setReviewCount(0);
        product.setCreatedAt(LocalDateTime.now());
        product.setUpdatedAt(LocalDateTime.now());
        productMapper.insert(product);
        log.info("Product created: id={}, name={}, sellerId={}", product.getId(), product.getName(), product.getSellerId());
        return toVO(product);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<MarketplaceProductVO> getProducts(ProductQueryRequest request) {
        LambdaQueryWrapper<MarketplaceProduct> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(MarketplaceProduct::getStatus, MarketplaceProductStatus.ACTIVE.name());

        if (request.getCategory() != null && !request.getCategory().isBlank()) {
            wrapper.eq(MarketplaceProduct::getCategory, request.getCategory());
        }
        if (request.getTag() != null && !request.getTag().isBlank()) {
            wrapper.like(MarketplaceProduct::getTags, request.getTag());
        }
        if (request.getMinPrice() != null) {
            wrapper.ge(MarketplaceProduct::getCreditsPrice, request.getMinPrice());
        }
        if (request.getMaxPrice() != null) {
            wrapper.le(MarketplaceProduct::getCreditsPrice, request.getMaxPrice());
        }

        // sort
        String sort = request.getSort();
        if ("price_asc".equals(sort)) {
            wrapper.orderByAsc(MarketplaceProduct::getCreditsPrice);
        } else if ("price_desc".equals(sort)) {
            wrapper.orderByDesc(MarketplaceProduct::getCreditsPrice);
        } else if ("sales_desc".equals(sort)) {
            wrapper.orderByDesc(MarketplaceProduct::getSalesCount);
        } else {
            wrapper.orderByDesc(MarketplaceProduct::getCreatedAt);
        }

        Page<MarketplaceProduct> pageResult = productMapper.selectPage(new Page<>(request.getPage(), request.getSize()), wrapper);
        Page<MarketplaceProductVO> voPage = new Page<>(pageResult.getCurrent(), pageResult.getSize(), pageResult.getTotal());
        voPage.setRecords(pageResult.getRecords().stream().map(this::toVO).toList());
        return voPage;
    }

    @Override
    @Transactional(readOnly = true)
    public MarketplaceProductVO getProduct(Long id) {
        MarketplaceProduct product = productMapper.selectById(id);
        if (product == null) {
            throw new BusinessException("商品不存在");
        }
        return toVO(product);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public MarketplaceProductVO updateProduct(Long id, CreateProductRequest request) {
        MarketplaceProduct product = productMapper.selectById(id);
        if (product == null) {
            throw new BusinessException("商品不存在");
        }
        product.setName(request.getName());
        product.setDescription(request.getDescription());
        product.setPrice(request.getPrice());
        product.setCreditsPrice(request.getCreditsPrice());
        product.setCategory(request.getCategory());
        product.setTags(request.getTags());
        product.setPreviewImages(request.getPreviewImages());
        product.setDemoUrl(request.getDemoUrl());
        product.setUpdatedAt(LocalDateTime.now());
        productMapper.updateById(product);
        return toVO(product);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deactivateProduct(Long id) {
        MarketplaceProduct product = productMapper.selectById(id);
        if (product == null) {
            throw new BusinessException("商品不存在");
        }
        product.setStatus(MarketplaceProductStatus.INACTIVE.name());
        product.setUpdatedAt(LocalDateTime.now());
        productMapper.updateById(product);
        log.info("Product deactivated: id={}", id);
    }

    private MarketplaceProductVO toVO(MarketplaceProduct product) {
        MarketplaceProductVO vo = new MarketplaceProductVO();
        vo.setId(product.getId());
        vo.setSellerId(product.getSellerId());
        vo.setType(product.getType());
        vo.setName(product.getName());
        vo.setDescription(product.getDescription());
        vo.setPrice(product.getPrice());
        vo.setCreditsPrice(product.getCreditsPrice());
        vo.setCategory(product.getCategory());
        vo.setTags(product.getTags());
        vo.setPreviewImages(product.getPreviewImages());
        vo.setDemoUrl(product.getDemoUrl());
        vo.setStatus(product.getStatus());
        vo.setSalesCount(product.getSalesCount());
        vo.setRating(product.getRating());
        vo.setReviewCount(product.getReviewCount());
        vo.setCreatedAt(product.getCreatedAt());
        vo.setUpdatedAt(product.getUpdatedAt());
        return vo;
    }
}
