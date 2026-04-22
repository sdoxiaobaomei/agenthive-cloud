package com.agenthive.payment.service.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CallbackDTO {
    @NotBlank(message = "支付单号不能为空")
    private String paymentNo;
    @NotBlank(message = "第三方单号不能为空")
    private String thirdPartyNo;
    private String status;
}
