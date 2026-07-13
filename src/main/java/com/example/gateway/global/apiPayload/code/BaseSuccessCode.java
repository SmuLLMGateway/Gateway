package com.example.gateway.global.apiPayload.code;

import lombok.Getter;
import org.springframework.http.HttpStatus;

public interface BaseSuccessCode {

    HttpStatus getHttpStatus();
    String getCode();
    String getMessage();
}
