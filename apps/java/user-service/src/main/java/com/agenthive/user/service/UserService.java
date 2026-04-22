package com.agenthive.user.service;

import com.agenthive.user.domain.vo.UserVO;
import com.agenthive.user.service.dto.UpdateUserRequest;

import java.util.List;

public interface UserService {

    UserVO getUserById(Long id);

    UserVO updateUser(Long id, UpdateUserRequest request);

    List<String> getUserRoles(Long id);
}
