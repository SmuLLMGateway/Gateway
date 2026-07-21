import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MemberDAO } from '../../../domain/user/dao/member.dao.js';
import { SecurityConfig } from '../config/security.config.js';
import { AccessTokenGuard } from '../guard/access-token.guard.js';
import { RefreshTokenGuard } from '../guard/refresh-token.guard.js';
import { RolesGuard } from '../guard/roles.guard.js';
import { JwtTokenService } from '../service/jwt-token.service.js';
import { PasswordEncoderService } from '../service/password-encoder.service.js';
import { SecurityPrincipalService } from '../service/security-principal.service.js';

@Module({
  imports: [JwtModule.register({}), TypeOrmModule.forFeature([MemberDAO])],
  providers: [
    SecurityConfig,
    JwtTokenService,
    PasswordEncoderService,
    SecurityPrincipalService,
    RefreshTokenGuard,
    {
      provide: APP_GUARD,
      useClass: AccessTokenGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
  exports: [JwtTokenService, PasswordEncoderService, RefreshTokenGuard],
})
export class SecurityModule {}
