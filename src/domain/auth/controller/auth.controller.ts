import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
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

@AuthControllerDocs()
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @LoginDocs()
  @Post('/auth/v1/login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: AuthReqDTO.Login
  ): Promise<GeneralResponse<AuthResDTO.Login>> {
    const result = await this.authService.login(dto);
    return GeneralResponse.onSuccess(AuthSuccessStatus.LOGIN, result);
  }

  @RefreshTokenDocs()
  @Post('/auth/v1/token')
  @HttpCode(HttpStatus.OK)
  async refreshToken(): Promise<GeneralResponse<AuthResDTO.RefreshToken>> {
    const result = await this.authService.refreshToken();
    return GeneralResponse.onSuccess(AuthSuccessStatus.REFRESHTOKEN, result);
  }

  @LogoutDocs()
  @Post('/auth/v1/logout')
  @HttpCode(HttpStatus.OK)
  async logout(): Promise<GeneralResponse<AuthResDTO.Logout>> {
    const result = await this.authService.logout();
    return GeneralResponse.onSuccess(AuthSuccessStatus.LOGOUT, result);
  }
}
