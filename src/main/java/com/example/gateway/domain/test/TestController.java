package com.example.gateway.domain.test;

import com.example.gateway.global.apiPayload.ApiResponse;
import com.example.gateway.global.apiPayload.code.BaseSuccessCode;
import com.example.gateway.global.apiPayload.code.GeneralErrorCode;
import com.example.gateway.global.apiPayload.code.GeneralSuccessCode;
import com.example.gateway.global.apiPayload.exception.GatewayException;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class TestController {

    @GetMapping("/test")
    public ApiResponse<String> test() {
        return ApiResponse.onSuccess(GeneralSuccessCode.OK, "test");
    }

    @GetMapping("/exception")
    public ApiResponse<String> exception() {
        throw new GatewayException(GeneralErrorCode.BAD_REQUEST_400);
    }
}
