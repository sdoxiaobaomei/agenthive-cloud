package com.agenthive.user.service.dto;

import jakarta.validation.constraints.Email;
import lombok.Data;

@Data
public class UpdateUserRequest {

    @Email(message = "Invalid email format")
    private String email;
    private String phone;
    private String avatar;
}
