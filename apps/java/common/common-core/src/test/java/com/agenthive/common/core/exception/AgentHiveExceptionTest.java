package com.agenthive.common.core.exception;

import com.agenthive.common.core.result.ResultCode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("AgentHiveException 业务异常测试")
class AgentHiveExceptionTest {

    @Test
    @DisplayName("通过 message 构造时 code 应为 500")
    void constructor_withMessage_shouldDefaultCodeTo500() {
        AgentHiveException ex = new AgentHiveException("Something went wrong");

        assertThat(ex.getCode()).isEqualTo(500);
        assertThat(ex.getMessage()).isEqualTo("Something went wrong");
    }

    @Test
    @DisplayName("通过 code 和 message 构造时应保留两者")
    void constructor_withCodeAndMessage_shouldPreserveBoth() {
        AgentHiveException ex = new AgentHiveException(7001, "User not found");

        assertThat(ex.getCode()).isEqualTo(7001);
        assertThat(ex.getMessage()).isEqualTo("User not found");
    }

    @Test
    @DisplayName("通过 ResultCode 构造时应映射 code 和 message")
    void constructor_withResultCode_shouldMapCodeAndMessage() {
        AgentHiveException ex = new AgentHiveException(ResultCode.INVALID_CREDENTIALS);

        assertThat(ex.getCode()).isEqualTo(7002);
        assertThat(ex.getMessage()).isEqualTo("Invalid username or password");
    }

    @Test
    @DisplayName("通过 code、message 和 cause 构造时应保留 cause")
    void constructor_withCause_shouldPreserveCause() {
        Throwable cause = new IllegalArgumentException("Invalid input");

        AgentHiveException ex = new AgentHiveException(500, "Wrapped error", cause);

        assertThat(ex.getCode()).isEqualTo(500);
        assertThat(ex.getMessage()).isEqualTo("Wrapped error");
        assertThat(ex.getCause()).isSameAs(cause);
    }

    @Test
    @DisplayName("所有 ResultCode 业务异常应正确映射")
    void allBusinessResultCodes_shouldMapCorrectly() {
        assertThat(new AgentHiveException(ResultCode.USER_ALREADY_EXISTS))
                .satisfies(e -> assertThat(e.getCode()).isEqualTo(7000));
        assertThat(new AgentHiveException(ResultCode.USER_NOT_FOUND))
                .satisfies(e -> assertThat(e.getCode()).isEqualTo(7001));
        assertThat(new AgentHiveException(ResultCode.INVALID_CREDENTIALS))
                .satisfies(e -> assertThat(e.getCode()).isEqualTo(7002));
        assertThat(new AgentHiveException(ResultCode.INVALID_TOKEN))
                .satisfies(e -> assertThat(e.getCode()).isEqualTo(7003));
        assertThat(new AgentHiveException(ResultCode.PASSWORD_TOO_WEAK))
                .satisfies(e -> assertThat(e.getCode()).isEqualTo(7004));
        assertThat(new AgentHiveException(ResultCode.RATE_LIMIT_EXCEEDED))
                .satisfies(e -> assertThat(e.getCode()).isEqualTo(7005));
    }
}
