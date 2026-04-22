package com.agenthive.user.service.impl;

import com.agenthive.common.core.exception.AgentHiveException;
import com.agenthive.common.core.result.ResultCode;
import com.agenthive.user.domain.entity.SysUser;
import com.agenthive.user.domain.vo.UserVO;
import com.agenthive.user.feign.AuthFeignClient;
import com.agenthive.user.mapper.UserMapper;
import com.agenthive.user.service.UserService;
import com.agenthive.user.service.dto.UpdateUserRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private final UserMapper userMapper;
    private final AuthFeignClient authFeignClient;

    @Override
    public UserVO getUserById(Long id) {
        SysUser user = userMapper.selectById(id);
        if (user == null) {
            throw new AgentHiveException(ResultCode.USER_NOT_FOUND);
        }
        return toUserVO(user);
    }

    @Override
    public UserVO updateUser(Long id, UpdateUserRequest request) {
        SysUser user = userMapper.selectById(id);
        if (user == null) {
            throw new AgentHiveException(ResultCode.USER_NOT_FOUND);
        }
        if (request.getEmail() != null) {
            user.setEmail(request.getEmail());
        }
        if (request.getPhone() != null) {
            user.setPhone(request.getPhone());
        }
        if (request.getAvatar() != null) {
            user.setAvatar(request.getAvatar());
        }
        userMapper.updateById(user);
        return toUserVO(user);
    }

    @Override
    public List<String> getUserRoles(Long id) {
        return authFeignClient.getUserRoles(id);
    }

    private UserVO toUserVO(SysUser user) {
        UserVO vo = new UserVO();
        vo.setId(user.getId());
        vo.setUsername(user.getUsername());
        vo.setEmail(user.getEmail());
        vo.setPhone(user.getPhone());
        vo.setAvatar(user.getAvatar());
        vo.setStatus(user.getStatus());
        vo.setCreatedAt(user.getCreatedAt());
        return vo;
    }
}
