package com.example.gateway.global.apiPayload;

import com.example.gateway.global.apiPayload.code.BaseErrorCode;
import com.example.gateway.global.apiPayload.code.BaseSuccessCode;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;

@AllArgsConstructor(access = AccessLevel.PRIVATE)
@JsonPropertyOrder({"isSuccess", "code", "message", "result"})
public class ApiResponse<T> {

    @JsonProperty("isSuccess") // isSuccess라는 변수라는 것을 명시하는 Annotation
    private boolean isSuccess;

    @JsonProperty("code")
    private String code;

    @JsonProperty("message")
    private String message;

    @JsonProperty("result")
    private final T result;

    // 상태 코드 받아 응답하는 메서드
    public static <T> ApiResponse<T> onSuccess(BaseSuccessCode code, T result) {
        return new ApiResponse<>(
                true,
                code.getCode(),
                code.getMessage(),
                result
        );
    }

    // 실패 응답 생성 메서드 (데이터 포함)
    public static <T> ApiResponse<T> onFailure(BaseErrorCode code, T result) {
        return new ApiResponse<>(
                false,
                code.getCode(),
                code.getMessage(),
                result
        );
    }

    // 실패 응답 생성 메서드 (데이터 없음)
    public static <T> ApiResponse<T> onFailure(BaseErrorCode code) {
        return new ApiResponse<>(
                false,
                code.getCode(),
                code.getMessage(),
                null
        );
    }
}
