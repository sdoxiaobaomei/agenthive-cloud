package com.agenthive.auth.controller;

import com.agenthive.auth.service.AuthService;
import com.agenthive.common.core.result.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * User query endpoints — migrated from user-service.
 * Kept under /users prefix for backward compatibility with existing Gateway routing.
 *
 * <p>All endpoints now delegate to {@link AuthService} since user data and auth data
 * reside in the same database (auth_db) after the merge.</p>
 */
@Slf4j
@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
@Tag(name = "User Management", description = "User profile and role query APIs (merged from user-service)")
public class UserController {

    private final AuthService authService;

    /**
     * Retrieves role codes for a given user.
     *
     * @param id the user ID; must be a positive integer
     * @return list of role codes (e.g. ["ADMIN", "USER"])
     */
    @Operation(summary = "Get user roles")
    @GetMapping("/{id}/roles")
    public Result<List<String>> getUserRoles(
            @PathVariable("id") @Positive(message = "User ID must be a positive integer") Long id) {
        String caller = SecurityContextHolder.getContext().getAuthentication() != null
                ? SecurityContextHolder.getContext().getAuthentication().getName()
                : "anonymous";
        log.info("User roles queried — targetUser={}, caller={}", id, caller);
        return Result.success(authService.getUserRoles(id));
    }
}
