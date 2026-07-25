import { applyDecorators } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
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
      AuthReqDTO.Login,
      AuthReqDTO.RefreshToken,
      AuthReqDTO.UpdatePassword,
      AuthResDTO.Login,
      AuthResDTO.RefreshToken,
      AuthResDTO.UpdatePassword,
    ),
  );
};

export const LoginDocs = () => {
  return applyDecorators(
    ApiOperation({
      summary: '로그인',
      description: '이메일과 비밀번호로 로그인하고 인증 토큰을 발급합니다.',
    }),
    ApiBody({ type: AuthReqDTO.Login }),
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
    ApiOperation({
      summary: '토큰 갱신',
      description: '액세스 토큰과 리프레시 토큰을 검증하여 인증 토큰을 갱신합니다.',
    }),
    ApiBody({ type: AuthReqDTO.RefreshToken }),
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
    ApiOperation({
      summary: '로그아웃',
      description: '현재 사용자의 인증 정보를 만료시켜 로그아웃합니다.',
    }),
    ApiSuccessResponse(AuthSuccessStatus.LOGOUT, SwaggerResultSchema.null()),
    ...ApiErrorResponses([
      AuthErrorStatus.TOKEN_EXPIRED,
      ErrorStatus.INTERNAL_SERVER_ERROR,
    ]),
  );
};

export const UpdateUserPasswordDocs = () => {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: '사용자 비밀번호 수정',
      description: '현재 비밀번호를 확인한 후 사용자 비밀번호를 수정합니다.',
    }),
    ApiBody({ type: AuthReqDTO.UpdatePassword }),
    ApiSuccessResponse(
      AuthSuccessStatus.UPDATE_PASSWORD,
      SwaggerResultSchema.model(getSchemaPath(AuthResDTO.UpdatePassword)),
    ),
    ...ApiErrorResponses([
      AuthErrorStatus.PASSWORD_ERROR,
      AuthErrorStatus.TOKEN_EXPIRED,
      AuthErrorStatus.USER_NOT_FOUND,
      ErrorStatus.INTERNAL_SERVER_ERROR,
    ]),
  );
};
