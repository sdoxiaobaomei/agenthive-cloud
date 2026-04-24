package com.agenthive.common.core.result;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Result 统一响应对象测试")
class ResultTest {

    @Test
    @DisplayName("success() 应返回 code=200、message=Success、无 data、isSuccess=true")
    void success_withoutData_shouldReturnStandardSuccess() {
        Result<Void> result = Result.success();

        assertThat(result.getCode()).isEqualTo(200);
        assertThat(result.getMessage()).isEqualTo("Success");
        assertThat(result.getData()).isNull();
        assertThat(result.isSuccess()).isTrue();
        assertThat(result.getTimestamp()).isNotNull();
    }

    @Test
    @DisplayName("success(data) 应返回 code=200 并携带数据")
    void success_withData_shouldReturnSuccessWithPayload() {
        String payload = "hello-agenthive";

        Result<String> result = Result.success(payload);

        assertThat(result.getCode()).isEqualTo(200);
        assertThat(result.getMessage()).isEqualTo("Success");
        assertThat(result.getData()).isEqualTo(payload);
        assertThat(result.isSuccess()).isTrue();
    }

    @Test
    @DisplayName("error(String) 应返回 code=500 和自定义 message")
    void error_withMessage_shouldReturnInternalError() {
        String errorMessage = "Database connection timeout";

        Result<Void> result = Result.error(errorMessage);

        assertThat(result.getCode()).isEqualTo(500);
        assertThat(result.getMessage()).isEqualTo(errorMessage);
        assertThat(result.getData()).isNull();
        assertThat(result.isSuccess()).isFalse();
    }

    @Test
    @DisplayName("error(Integer, String) 应返回自定义 code 和 message")
    void error_withCodeAndMessage_shouldReturnCustomError() {
        int customCode = 7001;
        String errorMessage = "User not found";

        Result<Void> result = Result.error(customCode, errorMessage);

        assertThat(result.getCode()).isEqualTo(customCode);
        assertThat(result.getMessage()).isEqualTo(errorMessage);
        assertThat(result.isSuccess()).isFalse();
    }

    @Test
    @DisplayName("error(ResultCode) 应使用 ResultCode 的 code 和 message")
    void error_withResultCode_shouldReturnMappedError() {
        Result<Void> result = Result.error(ResultCode.USER_ALREADY_EXISTS);

        assertThat(result.getCode()).isEqualTo(7000);
        assertThat(result.getMessage()).isEqualTo("User already exists");
        assertThat(result.isSuccess()).isFalse();
    }

    @Test
    @DisplayName("isSuccess() 应在 code 等于 200 时返回 true，否则返回 false")
    void isSuccess_shouldDependOnCode() {
        assertThat(Result.success().isSuccess()).isTrue();
        assertThat(Result.error("fail").isSuccess()).isFalse();
        assertThat(Result.error(ResultCode.UNAUTHORIZED).isSuccess()).isFalse();
        assertThat(Result.error(200, "Partial success").isSuccess()).isTrue();
    }

    @Test
    @DisplayName("每次创建 Result 时应生成新的 timestamp")
    void timestamp_shouldBeUniquePerInstance() throws InterruptedException {
        Result<Void> first = Result.success();
        Thread.sleep(10);
        Result<Void> second = Result.success();

        assertThat(first.getTimestamp()).isLessThan(second.getTimestamp());
    }
}
