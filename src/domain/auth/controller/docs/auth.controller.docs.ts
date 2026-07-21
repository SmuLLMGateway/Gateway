import { applyDecorators } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from "@nestjs/swagger";
import { AuthErrorStatus, AuthSuccessStatus } from "../../code/auth.status.js";
import { AuthReqDTO } from "../../dto/auth.request.dto.js";
import { AuthResDTO } from "../../dto/auth.response.dto.js";
import { ErrorStatus } from "../../../../global/apiPayload/code/status.js";
import {
  ApiErrorResponses,
  ApiSuccessResponse,
  SwaggerResultSchema,
} from "../../../../global/config/swagger.response.js";

export const AuthControllerDocs = () => {
  return applyDecorators(
    ApiTags('인증'),
    ApiExtraModels(
      AuthReqDTO.RefreshToken,
      AuthResDTO.Login,
      AuthResDTO.RefreshToken,
    ),
  );
};

export const LoginDocs = () => {
  return applyDecorators(
    ApiOperation({ summary: '로그인 API' }),
    ApiSuccessResponse(
      AuthSuccessStatus.LOGIN,
      SwaggerResultSchema.model(getSchemaPath(AuthResDTO.Login)),
    ),
    ...ApiErrorResponses([
      AuthErrorStatus.PASSWORD_ERROR,
      AuthErrorStatus.DISABLE_ACCOUNT,
      AuthErrorStatus.USER_NOT_FOUND,
      ErrorStatus.INTERNAL_SERVER_ERROR,
    ]),
  );
};

export const RefreshTokenDocs = () => {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: '토큰 갱신 API' }),
    ApiSuccessResponse(
      AuthSuccessStatus.REFRESHTOKEN,
      SwaggerResultSchema.model(getSchemaPath(AuthResDTO.RefreshToken)),
    ),
    ...ApiErrorResponses([
      AuthErrorStatus.TOKEN_EXPIRED,
      AuthErrorStatus.REFRESH_TOKEN_NOT_ALLOWED,
      AuthErrorStatus.ACCESS_TOKEN_NOT_ALLOWED,
      AuthErrorStatus.TOKEN_MISSING,
      AuthErrorStatus.TOKEN_INVALID,
      AuthErrorStatus.DISABLE_ACCOUNT,
      AuthErrorStatus.USER_NOT_FOUND,
      ErrorStatus.INTERNAL_SERVER_ERROR,
    ]),
  );
};

export const LogoutDocs = () => {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: '로그아웃 API' }),
    ApiSuccessResponse(AuthSuccessStatus.LOGOUT, SwaggerResultSchema.null()),
    ...ApiErrorResponses([
      AuthErrorStatus.TOKEN_EXPIRED,
      AuthErrorStatus.REFRESH_TOKEN_NOT_ALLOWED,
      AuthErrorStatus.TOKEN_MISSING,
      AuthErrorStatus.TOKEN_INVALID,
      AuthErrorStatus.USER_NOT_FOUND,
      ErrorStatus.INTERNAL_SERVER_ERROR,
    ]),
  );
};
