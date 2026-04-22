package com.agenthive.user.controller;

import com.agenthive.common.core.result.Result;
import com.agenthive.user.domain.vo.UserVO;
import com.agenthive.user.service.UserService;
import com.agenthive.user.service.dto.UpdateUserRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/{id}")
    public Result<UserVO> getUser(@PathVariable Long id) {
        return Result.success(userService.getUserById(id));
    }

    @PutMapping("/{id}")
    public Result<UserVO> updateUser(@PathVariable Long id, @Valid @RequestBody UpdateUserRequest request) {
        return Result.success(userService.updateUser(id, request));
    }

    @GetMapping("/{id}/roles")
    public Result<List<String>> getUserRoles(@PathVariable Long id) {
        return Result.success(userService.getUserRoles(id));
    }
}
