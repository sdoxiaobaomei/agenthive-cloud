package com.agenthive.order.service.impl;

import com.agenthive.common.core.exception.AgentHiveException;
import com.agenthive.common.core.result.PageResult;
import com.agenthive.order.domain.entity.CreatorEarning;
import com.agenthive.order.domain.entity.CreatorProduct;
import com.agenthive.order.domain.enums.ProductStatus;
import com.agenthive.order.domain.vo.CreatorDashboardVO;
import com.agenthive.order.domain.vo.CreatorEarningVO;
import com.agenthive.order.domain.vo.CreatorProductVO;
import com.agenthive.order.mapper.CreatorEarningMapper;
import com.agenthive.order.mapper.CreatorProductMapper;
import com.agenthive.order.service.CreatorService;
import com.agenthive.order.service.dto.PublishProductRequest;
import com.agenthive.order.service.dto.UpdateProductRequest;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class CreatorServiceImpl implements CreatorService {

    private final CreatorProductMapper creatorProductMapper;
    private final CreatorEarningMapper creatorEarningMapper;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CreatorProductVO publishProduct(Long creatorId, PublishProductRequest request) {
        CreatorProduct product = new CreatorProduct();
        product.setCreatorId(creatorId);
        product.setName(request.getName());
        product.setDescription(request.getDescription());
        product.setType(request.getType());
        product.setTechStackTags(joinTags(request.getTechStackTags()));
        product.setCreditsPrice(request.getCreditsPrice());
        product.setFiatPrice(request.getFiatPrice());
        product.setPreviewImages(joinTags(request.getPreviewImages()));
        product.setDemoUrl(request.getDemoUrl());
        product.setSourceProjectId(request.getSourceProjectId());
        product.setStatus(ProductStatus.ACTIVE);
        product.setSalesCount(0);
        product.setTotalRevenue(BigDecimal.ZERO);

        creatorProductMapper.insert(product);
        log.info("Product published: id={}, creatorId={}, name={}", product.getId(), creatorId, request.getName());
        return convertToProductVO(product);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CreatorProductVO updateProduct(Long creatorId, Long productId, UpdateProductRequest request) {
        CreatorProduct product = creatorProductMapper.selectById(productId);
        if (product == null || product.getDeleted() != 0) {
            throw new AgentHiveException(404, "商品不存在");
        }
        if (!product.getCreatorId().equals(creatorId)) {
            throw new AgentHiveException(403, "无权编辑该商品");
        }

        if (StringUtils.hasText(request.getName())) {
            product.setName(request.getName());
        }
        if (request.getDescription() != null) {
            product.setDescription(request.getDescription());
        }
        if (request.getType() != null) {
            product.setType(request.getType());
        }
        if (!CollectionUtils.isEmpty(request.getTechStackTags())) {
            product.setTechStackTags(joinTags(request.getTechStackTags()));
        }
        if (request.getCreditsPrice() != null) {
            product.setCreditsPrice(request.getCreditsPrice());
        }
        if (request.getFiatPrice() != null) {
            product.setFiatPrice(request.getFiatPrice());
        }
        if (!CollectionUtils.isEmpty(request.getPreviewImages())) {
            product.setPreviewImages(joinTags(request.getPreviewImages()));
        }
        if (request.getDemoUrl() != null) {
            product.setDemoUrl(request.getDemoUrl());
        }
        if (request.getStatus() != null) {
            product.setStatus(request.getStatus());
        }

        creatorProductMapper.updateById(product);
        log.info("Product updated: id={}, creatorId={}", productId, creatorId);
        return convertToProductVO(product);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void toggleProductStatus(Long creatorId, Long productId, ProductStatus status) {
        CreatorProduct product = creatorProductMapper.selectById(productId);
        if (product == null || product.getDeleted() != 0) {
            throw new AgentHiveException(404, "商品不存在");
        }
        if (!product.getCreatorId().equals(creatorId)) {
            throw new AgentHiveException(403, "无权操作该商品");
        }
        product.setStatus(status);
        creatorProductMapper.updateById(product);
        log.info("Product status toggled: id={}, status={}", productId, status);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteProduct(Long creatorId, Long productId) {
        CreatorProduct product = creatorProductMapper.selectById(productId);
        if (product == null || product.getDeleted() != 0) {
            throw new AgentHiveException(404, "商品不存在");
        }
        if (!product.getCreatorId().equals(creatorId)) {
            throw new AgentHiveException(403, "无权删除该商品");
        }
        creatorProductMapper.deleteById(productId);
        log.info("Product deleted: id={}, creatorId={}", productId, creatorId);
    }

    @Override
    public CreatorProductVO getProduct(Long productId) {
        CreatorProduct product = creatorProductMapper.selectById(productId);
        if (product == null || product.getDeleted() != 0) {
            throw new AgentHiveException(404, "商品不存在");
        }
        return convertToProductVO(product);
    }

    @Override
    public List<CreatorProductVO> listMyProducts(Long creatorId, ProductStatus status) {
        List<CreatorProduct> products;
        if (status != null) {
            products = creatorProductMapper.selectByCreatorIdAndStatus(creatorId, status.name());
        } else {
            products = creatorProductMapper.selectByCreatorId(creatorId);
        }
        return products.stream().map(this::convertToProductVO).collect(Collectors.toList());
    }

    @Override
    public CreatorDashboardVO getDashboard(Long creatorId) {
        LambdaQueryWrapper<CreatorProduct> productWrapper = new LambdaQueryWrapper<>();
        productWrapper.eq(CreatorProduct::getCreatorId, creatorId)
                .eq(CreatorProduct::getDeleted, 0);
        long totalProducts = creatorProductMapper.selectCount(productWrapper);

        LambdaQueryWrapper<CreatorProduct> activeWrapper = new LambdaQueryWrapper<>();
        activeWrapper.eq(CreatorProduct::getCreatorId, creatorId)
                .eq(CreatorProduct::getStatus, ProductStatus.ACTIVE)
                .eq(CreatorProduct::getDeleted, 0);
        long activeProducts = creatorProductMapper.selectCount(activeWrapper);

        int totalSales = creatorProductMapper.selectByCreatorId(creatorId).stream()
                .mapToInt(CreatorProduct::getSalesCount)
                .sum();

        BigDecimal totalRevenue = creatorProductMapper.selectByCreatorId(creatorId).stream()
                .map(CreatorProduct::getTotalRevenue)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        LocalDateTime monthStart = LocalDateTime.of(LocalDate.now().withDayOfMonth(1), LocalTime.MIN);
        LocalDateTime monthEnd = LocalDateTime.of(LocalDate.now().plusMonths(1).withDayOfMonth(1), LocalTime.MIN);
        BigDecimal monthlyEarning = creatorEarningMapper.sumNetEarningByDateRange(creatorId, monthStart, monthEnd);
        if (monthlyEarning == null) {
            monthlyEarning = BigDecimal.ZERO;
        }

        CreatorDashboardVO vo = new CreatorDashboardVO();
        vo.setActiveProductCount((int) activeProducts);
        vo.setTotalSales(totalSales);
        vo.setTotalRevenue(totalRevenue);
        vo.setMonthlyEarning(monthlyEarning);
        return vo;
    }

    @Override
    public PageResult<CreatorEarningVO> listEarnings(Long creatorId, LocalDate startDate, LocalDate endDate, long page, long size) {
        Page<CreatorEarning> pageParam = new Page<>(page, size);
        LambdaQueryWrapper<CreatorEarning> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(CreatorEarning::getCreatorId, creatorId)
                .eq(CreatorEarning::getDeleted, 0)
                .orderByDesc(CreatorEarning::getCreatedAt);
        if (startDate != null) {
            wrapper.ge(CreatorEarning::getCreatedAt, LocalDateTime.of(startDate, LocalTime.MIN));
        }
        if (endDate != null) {
            wrapper.lt(CreatorEarning::getCreatedAt, LocalDateTime.of(endDate.plusDays(1), LocalTime.MIN));
        }
        creatorEarningMapper.selectPage(pageParam, wrapper);

        List<CreatorEarningVO> records = pageParam.getRecords().stream()
                .map(this::convertToEarningVO)
                .collect(Collectors.toList());
        return new PageResult<>(records, pageParam.getTotal(), page, size);
    }

    private String joinTags(List<String> tags) {
        if (CollectionUtils.isEmpty(tags)) {
            return null;
        }
        return String.join(",", tags);
    }

    private List<String> splitTags(String tags) {
        if (!StringUtils.hasText(tags)) {
            return List.of();
        }
        return Arrays.asList(tags.split(","));
    }

    private CreatorProductVO convertToProductVO(CreatorProduct product) {
        CreatorProductVO vo = new CreatorProductVO();
        vo.setId(product.getId());
        vo.setCreatorId(product.getCreatorId());
        vo.setName(product.getName());
        vo.setDescription(product.getDescription());
        vo.setType(product.getType());
        vo.setTechStackTags(splitTags(product.getTechStackTags()));
        vo.setCreditsPrice(product.getCreditsPrice());
        vo.setFiatPrice(product.getFiatPrice());
        vo.setPreviewImages(splitTags(product.getPreviewImages()));
        vo.setDemoUrl(product.getDemoUrl());
        vo.setSourceProjectId(product.getSourceProjectId());
        vo.setStatus(product.getStatus());
        vo.setSalesCount(product.getSalesCount());
        vo.setTotalRevenue(product.getTotalRevenue());
        vo.setCreatedAt(product.getCreatedAt());
        vo.setUpdatedAt(product.getUpdatedAt());
        return vo;
    }

    private CreatorEarningVO convertToEarningVO(CreatorEarning earning) {
        CreatorEarningVO vo = new CreatorEarningVO();
        vo.setId(earning.getId());
        vo.setCreatorId(earning.getCreatorId());
        vo.setProductId(earning.getProductId());
        vo.setProductName(earning.getProductName());
        vo.setBuyerId(earning.getBuyerId());
        vo.setCreditsAmount(earning.getCreditsAmount());
        vo.setFiatAmount(earning.getFiatAmount());
        vo.setPlatformFee(earning.getPlatformFee());
        vo.setNetEarning(earning.getNetEarning());
        vo.setSettledAt(earning.getSettledAt());
        vo.setCreatedAt(earning.getCreatedAt());
        return vo;
    }
}
