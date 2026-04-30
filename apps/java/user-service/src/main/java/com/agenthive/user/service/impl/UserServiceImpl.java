package com.agenthive.user.service.impl;

import com.agenthive.user.feign.AuthFeignClient;
import com.agenthive.user.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private final AuthFeignClient authFeignClient;

    @Override
    public List<String> getUserRoles(Long id) {
        return authFeignClient.getUserRoles(id);
    }
}
