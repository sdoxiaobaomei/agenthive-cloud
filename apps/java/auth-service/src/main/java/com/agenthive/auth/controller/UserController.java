package com.agenthive.auth.controller;

import com.agenthive.auth.service.AuthService;
import com.agenthive.common.core.result.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * User query endpoints — migrated from user-service.
 * Kept under /users prefix for backward compatibility with existing Gateway routing.
 */
@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
@Tag(name = "User Management", description = "User profile and role query APIs (merged from user-service)")
public class UserController {

    private final AuthService authService;

    @Operation(summary = "Get user roles")
    @GetMapping("/{id}/roles")
    public Result<List<String>> getUserRoles(@PathVariable("id") Long id) {
        return Result.success(authService.getUserRoles(id));
    }
}
