import type { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource } from 'typeorm';
import type { EntityManager } from 'typeorm';
import { DepartmentDAO } from '../../src/domain/admin/dao/department.dao.js';
import { AdminController } from '../../src/domain/admin/controller/admin.controller.js';
import { AdminService } from '../../src/domain/admin/service/admin.service.js';
import { AuthController } from '../../src/domain/auth/controller/auth.controller.js';
import { AuthService } from '../../src/domain/auth/service/auth.service.js';
import { MemberDAO } from '../../src/domain/user/dao/member.dao.js';
import { MemberDepartmentDAO } from '../../src/domain/user/dao/member-department.dao.js';
import { UserData } from '../../src/domain/user/data/user.data.js';
import { UserMapper } from '../../src/domain/user/mapper/user.mapper.js';
import {
  GatewayExceptionFilter,
  GlobalExceptionFilter,
  HttpExceptionFilter,
} from '../../src/global/apiPayload/handler/exception.filter.js';
import { ResponseInterceptor } from '../../src/global/apiPayload/interceptors/response.interceptor.js';
import { AccessTokenGuard } from '../../src/global/security/guard/access-token.guard.js';
import { RefreshTokenGuard } from '../../src/global/security/guard/refresh-token.guard.js';
import { RolesGuard } from '../../src/global/security/guard/roles.guard.js';
import { JwtTokenService } from '../../src/global/security/service/jwt-token.service.js';
import { PasswordEncoderService } from '../../src/global/security/service/password-encoder.service.js';
import { SecurityPrincipalService } from '../../src/global/security/service/security-principal.service.js';
import type {
  TokenPair,
  VerifiedAccessToken,
} from '../../src/global/security/type/jwt-payload.type.js';
import { UserRole } from '../../src/global/security/type/user-role.enum.js';

describe('로그인/회원 생성 HTTP API', () => {
  const department: DepartmentDAO = {
    departmentId: '10',
    departmentName: '보안팀',
  };
  const loginDto = {
    email: 'member@example.com',
    password: 'raw-password',
  };
  const createUserDto = {
    name: '신규회원',
    email: 'new@example.com',
    password: 'raw-password',
    department: department.departmentName,
    role: UserRole.USER,
  };
  const tokenPair: TokenPair = {
    accessToken: 'issued-access-token',
    refreshToken: 'issued-refresh-token',
    accessTokenExpiredAt: '2026-07-20T10:15:00.000Z',
    refreshTokenExpiredAt: '2026-07-27T10:00:00.000Z',
  };
  const totalAdmin = createMember({
    memberId: '1',
    memberName: '총괄관리자',
    email: 'total@example.com',
    authorize: UserRole.TOTAL_ADMIN,
  });

  const authQueryBuilder = {
    select: jest.fn(),
    addSelect: jest.fn(),
    where: jest.fn(),
    getOne: jest.fn(),
  };
  const authMemberRepository = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };
  const departmentRepository = {
    findOneBy: jest.fn(),
  };
  const memberRepository = {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    save: jest.fn(),
  };
  const memberDepartmentRepository = {
    findOneBy: jest.fn(),
    save: jest.fn(),
  };
  const passwordEncoder = {
    encode: jest.fn(),
    matches: jest.fn(),
  };
  const tokenService = {
    issueTokenPair: jest.fn(),
    verifyAccessToken: jest.fn(),
    verifyRefreshToken: jest.fn(),
  };
  const userMapper = {
    toMemberDAO: jest.fn(),
    toMemberDepartmentDAO: jest.fn(),
  };
  const entityManager = {
    getRepository: jest.fn(),
  };
  const dataSource = {
    transaction: jest.fn(),
  };

  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController, AdminController],
      providers: [
        AuthService,
        AdminService,
        Reflector,
        AccessTokenGuard,
        RefreshTokenGuard,
        RolesGuard,
        SecurityPrincipalService,
        {
          provide: getRepositoryToken(MemberDAO),
          useValue: authMemberRepository,
        },
        { provide: DataSource, useValue: dataSource },
        { provide: PasswordEncoderService, useValue: passwordEncoder },
        { provide: JwtTokenService, useValue: tokenService },
        { provide: UserMapper, useValue: userMapper },
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
  });

  beforeEach(() => {
    resetMocks();

    authQueryBuilder.select.mockReturnValue(authQueryBuilder);
    authQueryBuilder.addSelect.mockReturnValue(authQueryBuilder);
    authQueryBuilder.where.mockReturnValue(authQueryBuilder);
    authQueryBuilder.getOne.mockResolvedValue(createMember());
    authMemberRepository.createQueryBuilder.mockReturnValue(authQueryBuilder);
    authMemberRepository.findOne.mockImplementation(
      async (options: { where: { memberId: string } }) =>
        principalMemberFor(options.where.memberId),
    );
    authMemberRepository.update.mockResolvedValue({ affected: 1 });

    passwordEncoder.matches.mockResolvedValue(true);
    passwordEncoder.encode.mockResolvedValue('$2b$12$encoded-password');
    tokenService.issueTokenPair.mockResolvedValue(tokenPair);
    tokenService.verifyAccessToken.mockImplementation(
      async (token: string): Promise<VerifiedAccessToken> =>
        verifiedAccessTokenFor(token),
    );

    departmentRepository.findOneBy.mockResolvedValue(department);
    memberRepository.findOne.mockResolvedValue(null);
    memberRepository.findOneBy.mockResolvedValue(totalAdmin);
    memberRepository.save.mockImplementation(async (member: MemberDAO) => ({
      ...member,
      memberId: '20',
    }));
    memberDepartmentRepository.findOneBy.mockResolvedValue({
      memberDepartmentId: '1',
      memberId: totalAdmin.memberId,
      departmentId: department.departmentId,
    });
    memberDepartmentRepository.save.mockImplementation(
      async (relation: MemberDepartmentDAO) => relation,
    );
    userMapper.toMemberDAO.mockImplementation(
      (data: Readonly<UserData.CreateMember>): MemberDAO => ({
        memberId: '',
        ...data,
      }),
    );
    userMapper.toMemberDepartmentDAO.mockImplementation(
      (
        data: Readonly<UserData.CreateMemberDepartment>,
      ): MemberDepartmentDAO => ({
        memberDepartmentId: '',
        ...data,
      } as MemberDepartmentDAO),
    );
    entityManager.getRepository.mockImplementation((entity: unknown) => {
      if (entity === DepartmentDAO) return departmentRepository;
      if (entity === MemberDAO) return memberRepository;
      if (entity === MemberDepartmentDAO) return memberDepartmentRepository;
      throw new Error('예상하지 못한 Repository입니다.');
    });
    dataSource.transaction.mockImplementation(
      async (
        work: (manager: EntityManager) => Promise<unknown>,
      ): Promise<unknown> =>
        work(entityManager as unknown as EntityManager),
    );
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('POST /auth/v1/login', () => {
    it('이메일과 비밀번호가 일치하면 토큰을 반환한다', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/v1/login')
        .send(loginDto)
        .expect(200);

      expect(tokenService.verifyAccessToken).not.toHaveBeenCalled();
      expect(authQueryBuilder.where).toHaveBeenCalledWith(
        'member.email = :email',
        { email: loginDto.email },
      );
      expect(passwordEncoder.matches).toHaveBeenCalledWith(
        loginDto.password,
        '$2b$12$encoded-password',
      );
      expect(authMemberRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          memberId: '12',
          disabledAt: expect.anything(),
        }),
        {
          loginAt: expect.any(Date),
          refreshToken: tokenPair.refreshToken,
        },
      );
      expect(tokenService.issueTokenPair).toHaveBeenCalledWith(12);
      const tokenIssueOrder =
        tokenService.issueTokenPair.mock.invocationCallOrder[0];
      const memberUpdateOrder =
        authMemberRepository.update.mock.invocationCallOrder[0];

      expect(tokenIssueOrder).toBeDefined();
      expect(memberUpdateOrder).toBeDefined();
      expect(
        tokenIssueOrder!,
      ).toBeLessThan(memberUpdateOrder!);
      expect(response.body).toEqual({
        isSuccess: true,
        code: 'AUTH200_1',
        message: '성공적으로 로그인했습니다.',
        result: {
          accessToken: tokenPair.accessToken,
          refreshToken: tokenPair.refreshToken,
          refreshTokenExpiredAt: tokenPair.refreshTokenExpiredAt,
        },
      });
    });

    it('등록되지 않은 이메일이면 USER_NOT_FOUND를 반환한다', async () => {
      authQueryBuilder.getOne.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .post('/auth/v1/login')
        .send(loginDto)
        .expect(404);

      expect(passwordEncoder.matches).not.toHaveBeenCalled();
      expect(authMemberRepository.update).not.toHaveBeenCalled();
      expect(tokenService.issueTokenPair).not.toHaveBeenCalled();
      expect(response.body).toEqual({
        isSuccess: false,
        code: 'AUTH404_1',
        message: '해당 사용자를 찾을 수 없습니다.',
      });
    });

    it('비밀번호가 일치하지 않으면 PASSWORD_ERROR를 반환한다', async () => {
      passwordEncoder.matches.mockResolvedValue(false);

      const response = await request(app.getHttpServer())
        .post('/auth/v1/login')
        .send({ ...loginDto, password: 'wrong-password' })
        .expect(400);

      expect(tokenService.issueTokenPair).not.toHaveBeenCalled();
      expect(authMemberRepository.update).not.toHaveBeenCalled();
      expect(response.body).toEqual({
        isSuccess: false,
        code: 'AUTH400_1',
        message: '이메일 혹은 비밀번호가 틀렸습니다.',
      });
    });

    it('비활성화 계정이면 DISABLE_ACCOUNT를 반환한다', async () => {
      authQueryBuilder.getOne.mockResolvedValue(
        createMember({ disabledAt: new Date('2026-07-19T00:00:00.000Z') }),
      );

      const response = await request(app.getHttpServer())
        .post('/auth/v1/login')
        .send(loginDto)
        .expect(400);

      expect(tokenService.issueTokenPair).not.toHaveBeenCalled();
      expect(authMemberRepository.update).not.toHaveBeenCalled();
      expect(response.body).toEqual({
        isSuccess: false,
        code: 'AUTH400_3',
        message: '계정이 비활성화 상태입니다.',
      });
    });
  });

  describe('POST /admin/v1/users', () => {
    it('TOTAL_ADMIN은 회원과 부서 관계를 저장하고 생성 결과를 반환한다', async () => {
      const response = await request(app.getHttpServer())
        .post('/admin/v1/users')
        .set('Authorization', 'Bearer total-token')
        .send(createUserDto)
        .expect(201);

      expect(passwordEncoder.encode).toHaveBeenCalledWith(createUserDto.password);
      expect(userMapper.toMemberDAO).toHaveBeenCalledWith(
        expect.objectContaining({
          profileUrl: '',
          refreshToken: null,
        }),
      );
      expect(memberRepository.save).toHaveBeenCalledTimes(1);
      expect(userMapper.toMemberDepartmentDAO).toHaveBeenCalledWith({
        memberId: '20',
        departmentId: department.departmentId,
      });
      expect(memberDepartmentRepository.save).toHaveBeenCalledTimes(1);
      expect(response.body).toEqual({
        isSuccess: true,
        code: 'ADMIN201_1',
        message: '성공적으로 사용자를 생성했습니다.',
        result: {
          name: createUserDto.name,
          role: '일반 사용자',
          createdAt: expect.any(String),
        },
      });
      expect(
        Number.isNaN(Date.parse(response.body.result.createdAt)),
      ).toBe(false);
    });

    it('DEPART_ADMIN은 자신이 관리하는 부서에 USER를 생성할 수 있다', async () => {
      const departAdmin = createMember({
        memberId: '2',
        memberName: '부서관리자',
        authorize: UserRole.DEPART_ADMIN,
      });
      memberRepository.findOneBy.mockResolvedValue(departAdmin);
      memberDepartmentRepository.findOneBy.mockResolvedValue({
        memberDepartmentId: '2',
        memberId: departAdmin.memberId,
        departmentId: department.departmentId,
      });

      await request(app.getHttpServer())
        .post('/admin/v1/users')
        .set('Authorization', 'Bearer depart-token')
        .send(createUserDto)
        .expect(201);

      expect(memberDepartmentRepository.findOneBy).toHaveBeenCalledWith({
        memberId: departAdmin.memberId,
        departmentId: department.departmentId,
      });
      expect(memberRepository.save).toHaveBeenCalledTimes(1);
    });

    it('부서가 없으면 이메일보다 먼저 DEPARTMENT_NOT_FOUND를 반환한다', async () => {
      departmentRepository.findOneBy.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .post('/admin/v1/users')
        .set('Authorization', 'Bearer total-token')
        .send({
          ...createUserDto,
          email: 'invalid-email',
          department: '존재하지 않는 부서',
        })
        .expect(404);

      expect(passwordEncoder.encode).not.toHaveBeenCalled();
      expect(memberRepository.save).not.toHaveBeenCalled();
      expect(response.body).toEqual({
        isSuccess: false,
        code: 'ADMIN404_2',
        message: '존재하지 않는 부서입니다.',
      });
    });

    it('이메일 형식이 잘못되면 INVALID_EMAIL을 반환한다', async () => {
      const response = await request(app.getHttpServer())
        .post('/admin/v1/users')
        .set('Authorization', 'Bearer total-token')
        .send({ ...createUserDto, email: 'invalid-email' })
        .expect(400);

      expect(passwordEncoder.encode).not.toHaveBeenCalled();
      expect(memberRepository.save).not.toHaveBeenCalled();
      expect(response.body).toEqual({
        isSuccess: false,
        code: 'ADMIN400_5',
        message: '이메일 형식이 올바르지 않습니다.',
      });
    });

    it('이미 등록된 이메일이면 DUPLICATE_EMAIL을 반환한다', async () => {
      memberRepository.findOne.mockResolvedValue({ memberId: '30' });

      const response = await request(app.getHttpServer())
        .post('/admin/v1/users')
        .set('Authorization', 'Bearer total-token')
        .send(createUserDto)
        .expect(400);

      expect(passwordEncoder.encode).not.toHaveBeenCalled();
      expect(memberRepository.save).not.toHaveBeenCalled();
      expect(response.body).toEqual({
        isSuccess: false,
        code: 'ADMIN400_1',
        message: '이미 생성된 이메일입니다.',
      });
    });

    it('USER가 접근하면 FORBIDDEN을 반환하고 서비스 로직을 실행하지 않는다', async () => {
      const response = await request(app.getHttpServer())
        .post('/admin/v1/users')
        .set('Authorization', 'Bearer user-token')
        .send(createUserDto)
        .expect(403);

      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(response.body).toEqual({
        isSuccess: false,
        code: 'AUTH403_1',
        message: '권한이 부족합니다.',
      });
    });

    it('같은 Access Token이라도 DB Role이 변경되면 다음 요청부터 즉시 반영한다', async () => {
      let currentRole = UserRole.TOTAL_ADMIN;
      authMemberRepository.findOne.mockImplementation(
        async (options: { where: { memberId: string } }) =>
          createMember({
            memberId: options.where.memberId,
            authorize: currentRole,
          }),
      );

      await request(app.getHttpServer())
        .post('/admin/v1/users')
        .set('Authorization', 'Bearer total-token')
        .send(createUserDto)
        .expect(201);

      currentRole = UserRole.USER;

      const response = await request(app.getHttpServer())
        .post('/admin/v1/users')
        .set('Authorization', 'Bearer total-token')
        .send(createUserDto)
        .expect(403);

      expect(tokenService.verifyAccessToken).toHaveBeenCalledTimes(2);
      expect(authMemberRepository.findOne).toHaveBeenCalledTimes(2);
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(response.body).toEqual({
        isSuccess: false,
        code: 'AUTH403_1',
        message: '권한이 부족합니다.',
      });
    });

    it('토큰 없이 접근하면 TOKEN_MISSING을 반환한다', async () => {
      const response = await request(app.getHttpServer())
        .post('/admin/v1/users')
        .send(createUserDto)
        .expect(401);

      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(response.body).toEqual({
        isSuccess: false,
        code: 'AUTH401_1',
        message: '인증 토큰이 필요합니다.',
      });
    });

    it('DEPART_ADMIN이 다른 관리자를 생성하면 FORBIDDEN을 반환한다', async () => {
      const departAdmin = createMember({
        memberId: '2',
        authorize: UserRole.DEPART_ADMIN,
      });
      memberRepository.findOneBy.mockResolvedValue(departAdmin);
      memberDepartmentRepository.findOneBy.mockResolvedValue({
        memberDepartmentId: '2',
        memberId: departAdmin.memberId,
        departmentId: department.departmentId,
      });

      const response = await request(app.getHttpServer())
        .post('/admin/v1/users')
        .set('Authorization', 'Bearer depart-token')
        .send({ ...createUserDto, role: UserRole.DEPART_ADMIN })
        .expect(403);

      expect(memberRepository.save).not.toHaveBeenCalled();
      expect(response.body).toEqual({
        isSuccess: false,
        code: 'AUTH403_1',
        message: '권한이 부족합니다.',
      });
    });
  });

  function resetMocks(): void {
    const mocks = [
      authQueryBuilder.select,
      authQueryBuilder.addSelect,
      authQueryBuilder.where,
      authQueryBuilder.getOne,
      authMemberRepository.createQueryBuilder,
      authMemberRepository.findOne,
      authMemberRepository.update,
      departmentRepository.findOneBy,
      memberRepository.findOne,
      memberRepository.findOneBy,
      memberRepository.save,
      memberDepartmentRepository.findOneBy,
      memberDepartmentRepository.save,
      passwordEncoder.encode,
      passwordEncoder.matches,
      tokenService.issueTokenPair,
      tokenService.verifyAccessToken,
      tokenService.verifyRefreshToken,
      userMapper.toMemberDAO,
      userMapper.toMemberDepartmentDAO,
      entityManager.getRepository,
      dataSource.transaction,
    ];

    mocks.forEach((mock) => mock.mockReset());
  }
});

function verifiedAccessTokenFor(token: string): VerifiedAccessToken {
  const authenticationByToken: Record<string, VerifiedAccessToken> = {
    'total-token': {
      userId: 1,
      expiredAt: '2026-07-20T10:00:00.000Z',
      accessToken: true,
    },
    'depart-token': {
      userId: 2,
      expiredAt: '2026-07-20T10:00:00.000Z',
      accessToken: true,
    },
    'user-token': {
      userId: 3,
      expiredAt: '2026-07-20T10:00:00.000Z',
      accessToken: true,
    },
  };
  const authentication = authenticationByToken[token];

  if (authentication === undefined) {
    throw new Error('테스트에서 정의하지 않은 토큰입니다.');
  }

  return authentication;
}

function principalMemberFor(memberId: string): MemberDAO {
  const roleByMemberId: Record<string, UserRole> = {
    '1': UserRole.TOTAL_ADMIN,
    '2': UserRole.DEPART_ADMIN,
    '3': UserRole.USER,
  };
  const authorize = roleByMemberId[memberId];

  if (authorize === undefined) {
    throw new Error('테스트에서 정의하지 않은 회원입니다.');
  }

  return createMember({ memberId, authorize });
}

function createMember(overrides: Partial<MemberDAO> = {}): MemberDAO {
  return {
    memberId: '12',
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
