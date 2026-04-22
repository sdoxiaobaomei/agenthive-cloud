package com.agenthive.common.core.exception;

import com.agenthive.common.core.result.ResultCode;
import lombok.Getter;

@Getter
public class AgentHiveException extends RuntimeException {

    private final Integer code;

    public AgentHiveException(String message) {
        super(message);
        this.code = 500;
    }

    public AgentHiveException(Integer code, String message) {
        super(message);
        this.code = code;
    }

    public AgentHiveException(ResultCode resultCode) {
        super(resultCode.getMessage());
        this.code = resultCode.getCode();
    }

    public AgentHiveException(Integer code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }
}
