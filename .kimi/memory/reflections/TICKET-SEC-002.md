# TICKET-SEC-002 Reflection

## Problem
Plaintext passwords were being exposed in logs and responses due to:
- `@Data` on `SysUser` and DTOs including `password` in `toString()` and Jackson serialization.
- MyBatis `StdOutImpl` writing SQL and parameters to stdout.
- `GlobalExceptionHandler` using SLF4J varargs which failed to print stack traces.

## Changes
1. **SysUser.java**: Replaced `@Data` with `@Getter @Setter @ToString(callSuper = true, exclude = {"password"}) @EqualsAndHashCode(callSuper = true)`. Added `@JsonIgnore` to `password`.
2. **LoginRequest.java / RegisterRequest.java / UpdateProfileRequest.java**: Replaced `@Data` with `@Getter @Setter @ToString(exclude = "password")`.
3. **application.yml**: Changed `log-impl` to `org.apache.ibatis.logging.slf4j.Slf4jImpl` and set `com.agenthive.auth.mapper` log level to `warn`.
4. **GlobalExceptionHandler.java**: Changed `log.error("Unexpected error at [{}]", request.getRequestURI(), e)` to `log.error("Unexpected error at [" + request.getRequestURI() + "]", e)` to force the `error(String, Throwable)` overload.

## Verification
- `mvn compile -pl common/common-web,auth-service -am` passed successfully.

## Security Review
- No business logic changed.
- No database schema changed.
- No `${}` SQL injection introduced.
- No hardcoded secrets added.

## Pattern to Retain
- Explicit Lombok annotations over `@Data` for entities and DTOs containing sensitive fields.
- Use string concatenation (or a dedicated `error(String, Throwable)` call) when logging exceptions to guarantee stack trace output.
