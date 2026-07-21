import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import { timingSafeEqual } from "node:crypto";
import { AuthReqDTO } from "../dto/auth.request.dto.js";
import { AuthResDTO } from "../dto/auth.response.dto.js";
import { AuthMapper } from "../mapper/auth.mapper.js";
import { AuthErrorStatus } from "../code/auth.status.js";
import { AuthException } from "../exception/auth.exception.js";
import { MemberDAO } from "../../user/dao/member.dao.js";
import { JwtTokenService } from "../../../global/security/service/jwt-token.service.js";
import { PasswordEncoderService } from "../../../global/security/service/password-encoder.service.js";
import type {
  AuthenticatedUser,
  VerifiedAccessToken,
} from "../../../global/security/type/jwt-payload.type.js";

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(MemberDAO)
    private readonly memberRepository: Repository<MemberDAO>,
    private readonly passwordEncoder: PasswordEncoderService,
    private readonly tokenService: JwtTokenService,
  ) {}

  async login(
    dto: AuthReqDTO.Login
  ): Promise<AuthResDTO.Login> {
    const member = await this.memberRepository
      .createQueryBuilder('member')
      .select([
        'member.memberId',
        'member.disabledAt',
      ])
      .addSelect('member.password')
      .where('member.email = :email', { email: dto.email })
      .getOne();

    if (member === null) {
      throw new AuthException(AuthErrorStatus.USER_NOT_FOUND);
    }

    const passwordMatches = await this.passwordEncoder.matches(
      dto.password,
      member.password,
    );

    if (!passwordMatches) {
      throw new AuthException(AuthErrorStatus.PASSWORD_ERROR);
    }

    if (member.disabledAt !== null) {
      throw new AuthException(AuthErrorStatus.DISABLE_ACCOUNT);
    }

    const tokens = await this.tokenService.issueTokenPair(
      this.toUserId(member.memberId),
    );
    const updateResult = await this.memberRepository.update(
      {
        memberId: member.memberId,
        disabledAt: IsNull(),
      },
      {
        loginAt: new Date(),
        refreshToken: tokens.refreshToken,
      },
    );

    if (updateResult.affected !== 1) {
      throw new AuthException(AuthErrorStatus.USER_NOT_FOUND);
    }

    return AuthMapper.toLogin(tokens);
  }

  async refreshToken(
    authentication: VerifiedAccessToken,
    presentedRefreshToken: string,
  ): Promise<AuthResDTO.RefreshToken> {
    const memberId = String(authentication.userId);
    const member = await this.memberRepository.findOne({
      select: {
        memberId: true,
        refreshToken: true,
        disabledAt: true,
      },
      where: { memberId },
    });

    if (member === null) {
      throw new AuthException(AuthErrorStatus.USER_NOT_FOUND);
    }

    if (member.disabledAt !== null) {
      throw new AuthException(AuthErrorStatus.DISABLE_ACCOUNT);
    }

    if (!this.refreshTokensMatch(member.refreshToken, presentedRefreshToken)) {
      throw new AuthException(AuthErrorStatus.TOKEN_INVALID);
    }

    const tokens = await this.tokenService.issueTokenPair(
      this.toUserId(member.memberId),
    );
    const updateResult = await this.memberRepository.update(
      {
        memberId: member.memberId,
        refreshToken: presentedRefreshToken,
        disabledAt: IsNull(),
      },
      { refreshToken: tokens.refreshToken },
    );

    if (updateResult.affected !== 1) {
      throw new AuthException(AuthErrorStatus.TOKEN_INVALID);
    }

    return AuthMapper.toLogin(tokens);
  }

  async logout(
    authentication: AuthenticatedUser,
  ): Promise<AuthResDTO.Logout> {
    const memberId = String(authentication.userId);
    const member = await this.memberRepository.findOne({
      select: { memberId: true },
      where: { memberId },
    });

    if (member === null) {
      throw new AuthException(AuthErrorStatus.USER_NOT_FOUND);
    }

    await this.memberRepository.update(
      { memberId: member.memberId },
      { refreshToken: null },
    );

    return null;
  }

  private refreshTokensMatch(
    storedRefreshToken: string | null,
    presentedRefreshToken: string,
  ): boolean {
    if (storedRefreshToken === null) {
      return false;
    }

    const stored = Buffer.from(storedRefreshToken);
    const presented = Buffer.from(presentedRefreshToken);

    return stored.length === presented.length
      && timingSafeEqual(stored, presented);
  }

  private toUserId(memberId: string): number {
    const userId = Number(memberId);

    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new Error('회원 ID를 JWT userId로 안전하게 변환할 수 없습니다.');
    }

    return userId;
  }
}
