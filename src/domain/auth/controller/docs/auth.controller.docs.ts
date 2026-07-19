import { applyDecorators } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from "@nestjs/swagger";
import { AuthErrorStatus, AuthSuccessStatus } from "../../code/auth.status.js";
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
    ApiExtraModels(AuthResDTO.Login, AuthResDTO.RefreshToken),
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
      ErrorStatus.INTERNAL_SERVER_ERROR,
    ]),
  );
};
