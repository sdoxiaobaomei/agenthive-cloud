package com.agenthive.auth.service.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateProfileRequest {

    @Size(min = 3, max = 64, message = "Username must be between 3 and 64 characters")
    private String username;

    @Size(min = 8, max = 128, message = "Password must be between 8 and 128 characters")
    private String password;

    private String avatar;
}
