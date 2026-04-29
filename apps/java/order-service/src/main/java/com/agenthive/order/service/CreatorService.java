package com.agenthive.order.service;

import com.agenthive.common.core.result.PageResult;
import com.agenthive.order.domain.enums.ProductStatus;
import com.agenthive.order.domain.vo.CreatorDashboardVO;
import com.agenthive.order.domain.vo.CreatorEarningVO;
import com.agenthive.order.domain.vo.CreatorProductVO;
import com.agenthive.order.service.dto.PublishProductRequest;
import com.agenthive.order.service.dto.UpdateProductRequest;

import java.time.LocalDate;
import java.util.List;

public interface CreatorService {

    CreatorProductVO publishProduct(Long creatorId, PublishProductRequest request);

    CreatorProductVO updateProduct(Long creatorId, Long productId, UpdateProductRequest request);

    void toggleProductStatus(Long creatorId, Long productId, ProductStatus status);

    void deleteProduct(Long creatorId, Long productId);

    CreatorProductVO getProduct(Long productId);

    List<CreatorProductVO> listMyProducts(Long creatorId, ProductStatus status);

    CreatorDashboardVO getDashboard(Long creatorId);

    PageResult<CreatorEarningVO> listEarnings(Long creatorId, LocalDate startDate, LocalDate endDate, long page, long size);
}
