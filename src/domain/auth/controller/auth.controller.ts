import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  AuthControllerDocs,
  LoginDocs,
  LogoutDocs,
  RefreshTokenDocs,
} from "./docs/auth.controller.docs.js";
import { GeneralResponse } from "../../../global/apiPayload/general.response.js";
import { AuthSuccessStatus } from "../code/auth.status.js";
import { AuthReqDTO } from "../dto/auth.request.dto.js";
import { AuthResDTO } from "../dto/auth.response.dto.js";
import { AuthService } from "../service/auth.service.js";
import { Public } from "../../../global/security/decorator/public.decorator.js";
import { CurrentRefreshToken } from "../../../global/security/decorator/current-refresh-token.decorator.js";
import { CurrentRefreshAccessToken } from "../../../global/security/decorator/current-refresh-access-token.decorator.js";
import { CurrentUser } from "../../../global/security/decorator/current-user.decorator.js";
import { RefreshTokenGuard } from "../../../global/security/guard/refresh-token.guard.js";
import type {
  AuthenticatedUser,
  VerifiedAccessToken,
} from "../../../global/security/type/jwt-payload.type.js";

@AuthControllerDocs()
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @LoginDocs()
  @Public()
  @Post('/auth/v1/login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: AuthReqDTO.Login
  ): Promise<GeneralResponse<AuthResDTO.Login>> {
    const result = await this.authService.login(dto);
    return GeneralResponse.onSuccess(AuthSuccessStatus.LOGIN, result);
  }

  @RefreshTokenDocs()
  // 전용 Guard가 만료된 Access Token과 Request Body의 Refresh Token을 검증합니다.
  @Public()
  @UseGuards(RefreshTokenGuard)
  @Post('/auth/v1/token')
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Body() _dto: AuthReqDTO.RefreshToken,
    @CurrentRefreshAccessToken() authentication: VerifiedAccessToken,
    @CurrentRefreshToken() refreshToken: string,
  ): Promise<GeneralResponse<AuthResDTO.RefreshToken>> {
    const result = await this.authService.refreshToken(
      authentication,
      refreshToken,
    );
    return GeneralResponse.onSuccess(AuthSuccessStatus.REFRESHTOKEN, result);
  }

  @LogoutDocs()
  @Post('/auth/v1/logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() authentication: AuthenticatedUser,
  ): Promise<GeneralResponse<AuthResDTO.Logout>> {
    const result = await this.authService.logout(authentication);
    return GeneralResponse.onSuccess(AuthSuccessStatus.LOGOUT, result);
  }
}
