package com.agenthive.common.core.result;

import lombok.Getter;

@Getter
public enum ResultCode {

    SUCCESS(200, "Success"),
    BAD_REQUEST(400, "Bad Request"),
    UNAUTHORIZED(401, "Unauthorized"),
    FORBIDDEN(403, "Forbidden"),
    NOT_FOUND(404, "Not Found"),
    METHOD_NOT_ALLOWED(405, "Method Not Allowed"),
    CONFLICT(409, "Conflict"),
    TOO_MANY_REQUESTS(429, "Too Many Requests"),
    INTERNAL_ERROR(500, "Internal Server Error"),
    SERVICE_UNAVAILABLE(503, "Service Unavailable"),

    // Business codes 7000-7999
    USER_ALREADY_EXISTS(7000, "User already exists"),
    USER_NOT_FOUND(7001, "User not found"),
    INVALID_CREDENTIALS(7002, "Invalid username or password"),
    INVALID_TOKEN(7003, "Invalid or expired token"),
    PASSWORD_TOO_WEAK(7004, "Password does not meet strength requirements"),
    RATE_LIMIT_EXCEEDED(7005, "Rate limit exceeded");

    private final int code;
    private final String message;

    ResultCode(int code, String message) {
        this.code = code;
        this.message = message;
    }
}
