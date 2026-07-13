package com.example.gateway.global.apiPayload.exception;

import com.example.gateway.global.apiPayload.code.BaseErrorCode;
import lombok.Getter;

@Getter
public class GatewayException extends RuntimeException {
    private final BaseErrorCode code;
    public GatewayException(BaseErrorCode code) { this.code = code; }
}
