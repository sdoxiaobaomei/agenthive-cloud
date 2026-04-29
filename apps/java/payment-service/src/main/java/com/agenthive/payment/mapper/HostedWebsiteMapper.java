package com.agenthive.payment.mapper;

import com.agenthive.payment.domain.entity.HostedWebsite;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface HostedWebsiteMapper extends BaseMapper<HostedWebsite> {

    @Select("SELECT COUNT(*) FROM t_hosted_website WHERE subdomain = #{subdomain}")
    int countBySubdomain(@Param("subdomain") String subdomain);
}
