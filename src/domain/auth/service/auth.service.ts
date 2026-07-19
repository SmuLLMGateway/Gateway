import { Injectable } from "@nestjs/common";
import { AuthReqDTO } from "../dto/auth.request.dto.js";
import { AuthResDTO } from "../dto/auth.response.dto.js";
import { AuthMapper } from "../mapper/auth.mapper.js";

@Injectable()
export class AuthService {
  async login(
    dto: AuthReqDTO.Login
  ): Promise<AuthResDTO.Login> {
    void dto;
    return AuthMapper.toLogin('','','');
  }

  async refreshToken(): Promise<AuthResDTO.RefreshToken> {
    return AuthMapper.toLogin('', '', '');
  }

  async logout(): Promise<AuthResDTO.Logout> {
    return null;
  }
}
