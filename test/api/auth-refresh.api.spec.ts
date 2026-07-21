import type { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { AuthController } from '../../src/domain/auth/controller/auth.controller.js';
import { AuthService } from '../../src/domain/auth/service/auth.service.js';
import { MemberDAO } from '../../src/domain/user/dao/member.dao.js';
import {
  GatewayExceptionFilter,
  GlobalExceptionFilter,
  HttpExceptionFilter,
} from '../../src/global/apiPayload/handler/exception.filter.js';
import { ResponseInterceptor } from '../../src/global/apiPayload/interceptors/response.interceptor.js';
import { SecurityConfig } from '../../src/global/security/config/security.config.js';
import { AccessTokenGuard } from '../../src/global/security/guard/access-token.guard.js';
import { RefreshTokenGuard } from '../../src/global/security/guard/refresh-token.guard.js';
import { RolesGuard } from '../../src/global/security/guard/roles.guard.js';
import { JwtTokenService } from '../../src/global/security/service/jwt-token.service.js';
import { PasswordEncoderService } from '../../src/global/security/service/password-encoder.service.js';
import { SecurityPrincipalService } from '../../src/global/security/service/security-principal.service.js';
import { UserRole } from '../../src/global/security/type/user-role.enum.js';

const TEST_SECURITY_CONFIG = {
  secret: 'refresh-api-test-secret-key-that-is-longer-than-32-characters',
  accessExpiresInSeconds: 900,
  refreshExpiresInSeconds: 3600,
};

describe('인증 토큰 HTTP API', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let tokenService: JwtTokenService;

  const memberRepository = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const passwordEncoder = {
    encode: jest.fn(),
    matches: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      controllers: [AuthController],
      providers: [
        AuthService,
        JwtTokenService,
        SecurityPrincipalService,
        Reflector,
        AccessTokenGuard,
        RefreshTokenGuard,
        RolesGuard,
        {
          provide: SecurityConfig,
          useValue: TEST_SECURITY_CONFIG,
        },
        {
          provide: getRepositoryToken(MemberDAO),
          useValue: memberRepository,
        },
        {
          provide: PasswordEncoderService,
          useValue: passwordEncoder,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalGuards(
      moduleRef.get(AccessTokenGuard),
      moduleRef.get(RolesGuard),
    );
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(
      new GlobalExceptionFilter(),
      new HttpExceptionFilter(),
      new GatewayExceptionFilter(),
    );
    await app.init();

    jwtService = moduleRef.get(JwtService);
    tokenService = moduleRef.get(JwtTokenService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    memberRepository.findOne.mockResolvedValue(
      createMember({ authorize: UserRole.DEPART_ADMIN }),
    );
    memberRepository.update.mockResolvedValue({ affected: 1 });
  });

  afterAll(async () => {
    await app.close();
  });

  it('발급한 Access/Refresh Token Payload에는 Role을 포함하지 않는다', async () => {
    const tokens = await tokenService.issueTokenPair(100);

    expect(jwtService.decode(tokens.accessToken)).not.toHaveProperty('role');
    expect(jwtService.decode(tokens.refreshToken)).not.toHaveProperty('role');
  });

  it('POST /auth/v1/logout은 Access Token 사용자 Refresh Token을 삭제한다', async () => {
    const tokens = await tokenService.issueTokenPair(100);
    memberRepository.findOne.mockResolvedValue(
      createMember({ refreshToken: tokens.refreshToken }),
    );

    const response = await logoutRequest(tokens.accessToken).expect(200);

    expect(response.body).toEqual({
      isSuccess: true,
      code: 'AUTH200_3',
      message: '성공적으로 로그아웃했습니다.',
      result: null,
    });
    expect(memberRepository.findOne).toHaveBeenCalledWith({
      select: {
        memberId: true,
        authorize: true,
        disabledAt: true,
      },
      where: { memberId: '100' },
    });
    expect(memberRepository.findOne).toHaveBeenCalledWith({
      select: { memberId: true },
      where: { memberId: '100' },
    });
    expect(memberRepository.update).toHaveBeenCalledWith(
      { memberId: '100' },
      { refreshToken: null },
    );
  });

  it('이미 Refresh Token이 없는 회원도 로그아웃에 성공한다', async () => {
    const tokens = await tokenService.issueTokenPair(100);
    memberRepository.findOne.mockResolvedValue(
      createMember({ refreshToken: null }),
    );

    const response = await logoutRequest(tokens.accessToken).expect(200);

    expect(response.body.code).toBe('AUTH200_3');
    expect(memberRepository.update).toHaveBeenCalledWith(
      { memberId: '100' },
      { refreshToken: null },
    );
  });

  it('로그아웃 대상 회원이 없으면 USER_NOT_FOUND를 반환한다', async () => {
    const tokens = await tokenService.issueTokenPair(100);
    memberRepository.findOne.mockResolvedValue(null);

    const response = await logoutRequest(tokens.accessToken).expect(404);

    expect(response.body).toEqual({
      isSuccess: false,
      code: 'AUTH404_1',
      message: '해당 사용자를 찾을 수 없습니다.',
    });
    expect(memberRepository.update).not.toHaveBeenCalled();
  });

  it('Access Token 없이 로그아웃하면 TOKEN_MISSING을 반환한다', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/v1/logout')
      .expect(401);

    expect(response.body).toEqual({
      isSuccess: false,
      code: 'AUTH401_1',
      message: '인증 토큰이 필요합니다.',
    });
    expect(memberRepository.findOne).not.toHaveBeenCalled();
    expect(memberRepository.update).not.toHaveBeenCalled();
  });

  it('Refresh Token으로 로그아웃하면 REFRESH_TOKEN_NOT_ALLOWED를 반환한다', async () => {
    const tokens = await tokenService.issueTokenPair(100);

    const response = await logoutRequest(tokens.refreshToken).expect(400);

    expect(response.body).toEqual({
      isSuccess: false,
      code: 'AUTH400_4',
      message: '엑세스 토큰으로 요청을 다시 보내주세요.',
    });
    expect(memberRepository.findOne).not.toHaveBeenCalled();
    expect(memberRepository.update).not.toHaveBeenCalled();
  });

  it('로그아웃 후 기존 Refresh Token으로 갱신할 수 없다', async () => {
    const tokens = await tokenService.issueTokenPair(100);
    let storedRefreshToken: string | null = tokens.refreshToken;

    memberRepository.findOne.mockImplementation(async () =>
      createMember({ refreshToken: storedRefreshToken }),
    );
    memberRepository.update.mockImplementation(
      async (
        _criteria: unknown,
        partial: { refreshToken?: string | null },
      ) => {
        if (partial.refreshToken !== undefined) {
          storedRefreshToken = partial.refreshToken;
        }

        return { affected: 1 };
      },
    );

    await logoutRequest(tokens.accessToken).expect(200);
    const refreshResponse = await refreshRequest(
      tokens.accessToken,
      tokens.refreshToken,
    ).expect(401);

    expect(storedRefreshToken).toBeNull();
    expect(refreshResponse.body).toEqual({
      isSuccess: false,
      code: 'AUTH401_2',
      message: '유효하지 않은 토큰입니다.',
    });
    expect(memberRepository.update).toHaveBeenCalledTimes(1);
  });

  it('같은 사용자의 Access/Refresh Token이면 새 토큰 쌍을 반환한다', async () => {
    const originalTokens = await tokenService.issueTokenPair(100);
    storeRefreshToken(originalTokens.refreshToken);

    const response = await refreshRequest(
      originalTokens.accessToken,
      originalTokens.refreshToken,
    ).expect(200);

    expect(response.body).toEqual({
      isSuccess: true,
      code: 'AUTH200_2',
      message: '성공적으로 토큰을 재발급했습니다.',
      result: {
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        refreshTokenExpiredAt: expect.any(String),
      },
    });
    expect(memberRepository.findOne).toHaveBeenCalledWith({
      select: {
        memberId: true,
        refreshToken: true,
        disabledAt: true,
      },
      where: { memberId: '100' },
    });
    expect(memberRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        memberId: '100',
        refreshToken: originalTokens.refreshToken,
        disabledAt: expect.anything(),
      }),
      { refreshToken: response.body.result.refreshToken },
    );
    expect(response.body.result.refreshToken).not.toBe(
      originalTokens.refreshToken,
    );

    const renewedAccess = await tokenService.verifyAccessToken(
      response.body.result.accessToken,
    );
    const renewedRefresh = await tokenService.verifyRefreshToken(
      response.body.result.refreshToken,
    );

    expect(renewedAccess).toMatchObject({
      userId: 100,
      accessToken: true,
    });
    expect(renewedRefresh).toMatchObject({
      userId: 100,
      accessToken: false,
    });
    expect(renewedRefresh.expiredAt).toBe(
      response.body.result.refreshTokenExpiredAt,
    );
  });

  it('만료된 Access Token도 서명과 타입이 유효하면 재발급에 사용할 수 있다', async () => {
    const expiredAccessToken = await signToken({
      userId: 100,
      accessToken: true,
      expiresIn: -1,
      expiredAt: new Date(Date.now() - 1000).toISOString(),
    });
    const refreshTokens = await tokenService.issueTokenPair(100);
    storeRefreshToken(refreshTokens.refreshToken);

    const response = await refreshRequest(
      expiredAccessToken,
      refreshTokens.refreshToken,
    ).expect(200);

    expect(response.body.code).toBe('AUTH200_2');
  });

  it('DB에 저장된 Refresh Token과 다르면 TOKEN_INVALID를 반환한다', async () => {
    const firstUserTokens = await tokenService.issueTokenPair(100);
    const secondUserTokens = await tokenService.issueTokenPair(200);
    storeRefreshToken(firstUserTokens.refreshToken);

    const response = await refreshRequest(
      firstUserTokens.accessToken,
      secondUserTokens.refreshToken,
    ).expect(401);

    expect(response.body).toEqual({
      isSuccess: false,
      code: 'AUTH401_2',
      message: '유효하지 않은 토큰입니다.',
    });
    expect(memberRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { memberId: '100' } }),
    );
    expect(memberRepository.update).not.toHaveBeenCalled();
  });

  it('Request Body에 Access Token을 보내면 AUTH400_5를 반환한다', async () => {
    const tokens = await tokenService.issueTokenPair(100);

    const response = await refreshRequest(
      tokens.accessToken,
      tokens.accessToken,
    ).expect(400);

    expect(response.body).toEqual({
      isSuccess: false,
      code: 'AUTH400_5',
      message: '리프레시 토큰으로 요청을 다시 보내주세요.',
    });
    expect(memberRepository.findOne).not.toHaveBeenCalled();
    expect(memberRepository.update).not.toHaveBeenCalled();
  });

  it('Authorization에 Refresh Token을 보내면 AUTH400_4를 반환한다', async () => {
    const tokens = await tokenService.issueTokenPair(100);

    const response = await refreshRequest(
      tokens.refreshToken,
      tokens.refreshToken,
    ).expect(400);

    expect(response.body).toEqual({
      isSuccess: false,
      code: 'AUTH400_4',
      message: '엑세스 토큰으로 요청을 다시 보내주세요.',
    });
    expect(memberRepository.findOne).not.toHaveBeenCalled();
    expect(memberRepository.update).not.toHaveBeenCalled();
  });

  it('만료된 Refresh Token이면 AUTH400_2를 반환한다', async () => {
    const tokens = await tokenService.issueTokenPair(100);
    const expiredRefreshToken = await signToken({
      userId: 100,
      accessToken: false,
      expiresIn: -1,
      expiredAt: new Date(Date.now() - 1000).toISOString(),
    });

    const response = await refreshRequest(
      tokens.accessToken,
      expiredRefreshToken,
    ).expect(400);

    expect(response.body).toEqual({
      isSuccess: false,
      code: 'AUTH400_2',
      message: '토큰이 만료되었습니다.',
    });
    expect(memberRepository.findOne).not.toHaveBeenCalled();
    expect(memberRepository.update).not.toHaveBeenCalled();
  });

  it('위조된 Refresh Token이면 AUTH401_2를 반환한다', async () => {
    const tokens = await tokenService.issueTokenPair(100);
    const forgedRefreshToken = await signToken({
      userId: 100,
      accessToken: false,
      expiresIn: 3600,
      expiredAt: new Date(Date.now() + 3600_000).toISOString(),
      secret: 'forged-refresh-test-secret-that-is-also-long-enough',
    });

    const response = await refreshRequest(
      tokens.accessToken,
      forgedRefreshToken,
    ).expect(401);

    expect(response.body).toEqual({
      isSuccess: false,
      code: 'AUTH401_2',
      message: '유효하지 않은 토큰입니다.',
    });
    expect(memberRepository.findOne).not.toHaveBeenCalled();
    expect(memberRepository.update).not.toHaveBeenCalled();
  });

  it('Access Token이 없으면 AUTH401_1을 반환한다', async () => {
    const tokens = await tokenService.issueTokenPair(100);

    const response = await request(app.getHttpServer())
      .post('/auth/v1/token')
      .send({ refreshToken: tokens.refreshToken })
      .expect(401);

    expect(response.body).toEqual({
      isSuccess: false,
      code: 'AUTH401_1',
      message: '인증 토큰이 필요합니다.',
    });
  });

  it('Request Body에 Refresh Token이 없으면 AUTH401_1을 반환한다', async () => {
    const tokens = await tokenService.issueTokenPair(100);

    const response = await request(app.getHttpServer())
      .post('/auth/v1/token')
      .set('Authorization', `Bearer ${tokens.accessToken}`)
      .send({})
      .expect(401);

    expect(response.body).toEqual({
      isSuccess: false,
      code: 'AUTH401_1',
      message: '인증 토큰이 필요합니다.',
    });
  });

  it('회원이 존재하지 않으면 AUTH404_1을 반환한다', async () => {
    const tokens = await tokenService.issueTokenPair(100);
    memberRepository.findOne.mockResolvedValue(null);

    const response = await refreshRequest(
      tokens.accessToken,
      tokens.refreshToken,
    ).expect(404);

    expect(response.body).toEqual({
      isSuccess: false,
      code: 'AUTH404_1',
      message: '해당 사용자를 찾을 수 없습니다.',
    });
    expect(memberRepository.update).not.toHaveBeenCalled();
  });

  it('비활성화 회원이면 AUTH400_3을 반환한다', async () => {
    const tokens = await tokenService.issueTokenPair(100);
    memberRepository.findOne.mockResolvedValue(
      createMember({
        memberId: '100',
        refreshToken: tokens.refreshToken,
        disabledAt: new Date('2026-07-20T00:00:00.000Z'),
      }),
    );

    const response = await refreshRequest(
      tokens.accessToken,
      tokens.refreshToken,
    ).expect(400);

    expect(response.body).toEqual({
      isSuccess: false,
      code: 'AUTH400_3',
      message: '계정이 비활성화 상태입니다.',
    });
    expect(memberRepository.update).not.toHaveBeenCalled();
  });

  it('DB에 저장된 Refresh Token이 없으면 TOKEN_INVALID를 반환한다', async () => {
    const tokens = await tokenService.issueTokenPair(100);
    memberRepository.findOne.mockResolvedValue(
      createMember({ refreshToken: null }),
    );

    const response = await refreshRequest(
      tokens.accessToken,
      tokens.refreshToken,
    ).expect(401);

    expect(response.body).toEqual({
      isSuccess: false,
      code: 'AUTH401_2',
      message: '유효하지 않은 토큰입니다.',
    });
    expect(memberRepository.update).not.toHaveBeenCalled();
  });

  it('동시에 먼저 갱신되어 조건부 UPDATE가 실패하면 TOKEN_INVALID를 반환한다', async () => {
    const tokens = await tokenService.issueTokenPair(100);
    storeRefreshToken(tokens.refreshToken);
    memberRepository.update.mockResolvedValue({ affected: 0 });

    const response = await refreshRequest(
      tokens.accessToken,
      tokens.refreshToken,
    ).expect(401);

    expect(response.body).toEqual({
      isSuccess: false,
      code: 'AUTH401_2',
      message: '유효하지 않은 토큰입니다.',
    });
    expect(memberRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        memberId: '100',
        refreshToken: tokens.refreshToken,
        disabledAt: expect.anything(),
      }),
      { refreshToken: expect.any(String) },
    );
  });

  it('갱신이 끝난 뒤 기존 Refresh Token을 재사용하면 거부한다', async () => {
    const originalTokens = await tokenService.issueTokenPair(100);
    let storedRefreshToken = originalTokens.refreshToken;

    memberRepository.findOne.mockImplementation(async () =>
      createMember({
        authorize: UserRole.DEPART_ADMIN,
        refreshToken: storedRefreshToken,
      }),
    );
    memberRepository.update.mockImplementation(
      async (
        criteria: { refreshToken?: string },
        partial: { refreshToken?: string },
      ) => {
        if (
          criteria.refreshToken !== storedRefreshToken
          || partial.refreshToken === undefined
        ) {
          return { affected: 0 };
        }

        storedRefreshToken = partial.refreshToken;
        return { affected: 1 };
      },
    );

    const firstResponse = await refreshRequest(
      originalTokens.accessToken,
      originalTokens.refreshToken,
    ).expect(200);
    const reusedResponse = await refreshRequest(
      originalTokens.accessToken,
      originalTokens.refreshToken,
    ).expect(401);

    expect(storedRefreshToken).toBe(firstResponse.body.result.refreshToken);
    expect(reusedResponse.body).toEqual({
      isSuccess: false,
      code: 'AUTH401_2',
      message: '유효하지 않은 토큰입니다.',
    });
    expect(memberRepository.update).toHaveBeenCalledTimes(1);
  });

  function storeRefreshToken(refreshToken: string): void {
    memberRepository.findOne.mockResolvedValue(
      createMember({
        memberId: '100',
        authorize: UserRole.DEPART_ADMIN,
        refreshToken,
      }),
    );
  }

  function refreshRequest(accessToken: string, refreshToken: string) {
    return request(app.getHttpServer())
      .post('/auth/v1/token')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken });
  }

  function logoutRequest(accessToken: string) {
    return request(app.getHttpServer())
      .post('/auth/v1/logout')
      .set('Authorization', `Bearer ${accessToken}`);
  }

  async function signToken(options: {
    userId: number;
    accessToken: boolean;
    expiresIn: number;
    expiredAt: string;
    secret?: string;
  }): Promise<string> {
    return jwtService.signAsync(
      {
        userId: options.userId,
        expiredAt: options.expiredAt,
        accessToken: options.accessToken,
      },
      {
        secret: options.secret ?? TEST_SECURITY_CONFIG.secret,
        algorithm: 'HS256',
        expiresIn: options.expiresIn,
      },
    );
  }
});

function createMember(overrides: Partial<MemberDAO> = {}): MemberDAO {
  return {
    memberId: '100',
    memberName: '테스트회원',
    email: 'member@example.com',
    password: '$2b$12$encoded-password',
    authorize: UserRole.USER,
    profileUrl: '',
    refreshToken: null,
    loginAt: new Date('2026-07-20T00:00:00.000Z'),
    createdAt: new Date('2026-07-20T00:00:00.000Z'),
    createdBy: '관리자',
    disabledAt: null,
    ...overrides,
  };
}
