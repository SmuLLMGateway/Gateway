import type { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource, QueryFailedError } from 'typeorm';
import type { EntityManager } from 'typeorm';
import { DepartmentDAO } from '../../src/domain/admin/dao/department.dao.js';
import { ActiveApiKeyDAO } from '../../src/domain/admin/dao/active-api-key.dao.js';
import { ActiveLlmDAO } from '../../src/domain/admin/dao/active-llm.dao.js';
import { LlmDetailModelDAO } from '../../src/domain/admin/dao/llm-detail-model.dao.js';
import { MaskingClass, PolicyDAO } from '../../src/domain/admin/dao/policy.dao.js';
import { DepartmentPolicyDAO } from '../../src/domain/admin/dao/department-policy.dao.js';
import { AdminController } from '../../src/domain/admin/controller/admin.controller.js';
import { AdminMapper } from '../../src/domain/admin/mapper/admin.mapper.js';
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
import { LlmApiKeyValidationClient } from '../../src/global/llm/client/llm-api-key-validation.client.js';
import { LlmApiKeyValidationResult } from '../../src/global/llm/enum/llm-api-key-validation-result.enum.js';
import { LlmProvider } from '../../src/global/llm/enum/llm-provider.enum.js';
import { ApiKeyEncryptionService } from '../../src/global/llm/service/api-key-encryption.service.js';

describe('로그인/회원 생성 HTTP API', () => {
  const department: DepartmentDAO = {
    departmentId: '10',
    departmentName: '보안팀',
  };
  const loginDto = {
    email: 'member@example.com',
    password: 'raw-password',
  };
  const updatePasswordDto = {
    oldPassword: 'raw-password',
    newPassword: 'new-password',
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
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    save: jest.fn(),
  };
  const memberRepository = {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    save: jest.fn(),
  };
  const memberDepartmentRepository = {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    save: jest.fn(),
  };
  const activeApiKeyRepository = {
    findOneBy: jest.fn(),
    save: jest.fn(),
  };
  const activeLlmRepository = {
    upsert: jest.fn(),
  };
  const llmDetailModelRepository = {
    find: jest.fn(),
  };
  const policyRepository = {
    delete: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    save: jest.fn(),
  };
  const departmentPolicyRepository = {
    create: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
  };
  const apiKeyValidationClient = {
    validate: jest.fn(),
  };
  const apiKeyEncryption = {
    encrypt: jest.fn(),
    decrypt: jest.fn(),
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
  const adminMapper = {
    toDepartmentDAO: jest.fn(),
    toActiveApiKeyDAO: jest.fn(),
    toPolicyDAO: jest.fn(),
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
        {
          provide: getRepositoryToken(DepartmentDAO),
          useValue: departmentRepository,
        },
        {
          provide: getRepositoryToken(MemberDepartmentDAO),
          useValue: memberDepartmentRepository,
        },
        {
          provide: getRepositoryToken(ActiveApiKeyDAO),
          useValue: activeApiKeyRepository,
        },
        {
          provide: getRepositoryToken(ActiveLlmDAO),
          useValue: activeLlmRepository,
        },
        {
          provide: getRepositoryToken(LlmDetailModelDAO),
          useValue: llmDetailModelRepository,
        },
        {
          provide: getRepositoryToken(PolicyDAO),
          useValue: policyRepository,
        },
        {
          provide: LlmApiKeyValidationClient,
          useValue: apiKeyValidationClient,
        },
        {
          provide: ApiKeyEncryptionService,
          useValue: apiKeyEncryption,
        },
        { provide: PasswordEncoderService, useValue: passwordEncoder },
        { provide: JwtTokenService, useValue: tokenService },
        { provide: UserMapper, useValue: userMapper },
        { provide: AdminMapper, useValue: adminMapper },
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
    departmentRepository.findOne.mockImplementation(
      async (options: { lock?: { mode?: string } }) =>
        options.lock?.mode === 'pessimistic_write' ? department : null,
    );
    departmentRepository.save.mockImplementation(
      async (savedDepartment: DepartmentDAO): Promise<DepartmentDAO> => ({
        ...savedDepartment,
        departmentId: '11',
      }),
    );
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
    memberDepartmentRepository.findOne.mockResolvedValue({
      memberDepartmentId: '3',
      memberId: '3',
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
    adminMapper.toDepartmentDAO.mockImplementation(
      (data: { departmentName: string }): DepartmentDAO => ({
        departmentId: '',
        departmentName: data.departmentName,
      }),
    );
    adminMapper.toActiveApiKeyDAO.mockImplementation(
      (data: Omit<ActiveApiKeyDAO, 'activeApiKeyId' | 'department'>) => ({
        activeApiKeyId: '',
        ...data,
      }),
    );
    activeApiKeyRepository.findOneBy.mockResolvedValue(null);
    activeApiKeyRepository.save.mockImplementation(
      async (apiKey: ActiveApiKeyDAO) => {
        apiKey.activeApiKeyId ||= '71';
        return apiKey;
      },
    );
    activeLlmRepository.upsert.mockResolvedValue(undefined);
    llmDetailModelRepository.find.mockResolvedValue([
      { llmDetailModelId: '301', llmName: 'gpt-4.1' },
      { llmDetailModelId: '302', llmName: 'GPT-4o' },
    ]);
    apiKeyValidationClient.validate.mockResolvedValue(
      LlmApiKeyValidationResult.VALID,
    );
    policyRepository.findOneBy.mockResolvedValue(null);
    policyRepository.findOne.mockResolvedValue(null);
    policyRepository.find.mockResolvedValue([]);
    policyRepository.delete.mockResolvedValue({ affected: 1 });
    policyRepository.save.mockImplementation(async (value: PolicyDAO | PolicyDAO[]) => {
      const saveOne = (policy: PolicyDAO, index = 0) => ({
        ...policy,
        policyId: policy.policyId || String(7 + index),
      });
      return Array.isArray(value)
        ? value.map(saveOne)
        : saveOne(value);
    });
    adminMapper.toPolicyDAO.mockImplementation(
      (data: Omit<PolicyDAO, 'policyId' | 'departmentPolicies' | 'isActive'>) => ({
        policyId: '',
        isActive: true,
        ...data,
      }),
    );
    departmentPolicyRepository.find.mockResolvedValue([]);
    departmentPolicyRepository.create.mockImplementation(
      (
        data: Omit<
          DepartmentPolicyDAO,
          'departmentPolicyId' | 'department'
        >,
      ): DepartmentPolicyDAO => ({
        departmentPolicyId: '',
        ...data,
      } as DepartmentPolicyDAO),
    );
    departmentPolicyRepository.save.mockImplementation(
      async (items: DepartmentPolicyDAO[]): Promise<DepartmentPolicyDAO[]> =>
        items,
    );
    apiKeyEncryption.encrypt.mockReturnValue('v1.encrypted-api-key');
    entityManager.getRepository.mockImplementation((entity: unknown) => {
      if (entity === DepartmentDAO) return departmentRepository;
      if (entity === MemberDAO) return memberRepository;
      if (entity === MemberDepartmentDAO) return memberDepartmentRepository;
      if (entity === ActiveApiKeyDAO) return activeApiKeyRepository;
      if (entity === ActiveLlmDAO) return activeLlmRepository;
      if (entity === LlmDetailModelDAO) return llmDetailModelRepository;
      if (entity === PolicyDAO) return policyRepository;
      if (entity === DepartmentPolicyDAO) return departmentPolicyRepository;
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

    it('등록되지 않은 이메일이면 PASSWORD_ERROR를 반환한다', async () => {
      authQueryBuilder.getOne.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .post('/auth/v1/login')
        .send(loginDto)
        .expect(400);

      expect(passwordEncoder.matches).not.toHaveBeenCalled();
      expect(authMemberRepository.update).not.toHaveBeenCalled();
      expect(tokenService.issueTokenPair).not.toHaveBeenCalled();
      expect(response.body).toEqual({
        isSuccess: false,
        code: 'AUTH400_1',
        message: '이메일 혹은 비밀번호가 틀렸습니다.',
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

  describe('PATCH /auth/v1/password', () => {
    it('Access Token의 userId로 회원을 조회하고 비밀번호를 변경한다', async () => {
      const response = await request(app.getHttpServer())
        .patch('/auth/v1/password')
        .set('Authorization', 'Bearer user-token')
        .send(updatePasswordDto)
        .expect(200);

      expect(authMemberRepository.findOne).toHaveBeenCalledWith({
        select: {
          memberId: true,
          password: true,
          disabledAt: true,
        },
        where: { memberId: '3' },
      });
      expect(passwordEncoder.matches).toHaveBeenCalledWith(
        updatePasswordDto.oldPassword,
        '$2b$12$encoded-password',
      );
      expect(passwordEncoder.encode).toHaveBeenCalledWith(
        updatePasswordDto.newPassword,
      );
      expect(authMemberRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          memberId: '3',
          password: '$2b$12$encoded-password',
          disabledAt: expect.anything(),
        }),
        { password: '$2b$12$encoded-password' },
      );
      expect(response.body).toEqual({
        isSuccess: true,
        code: 'AUTH200_4',
        message: '성공적으로 해당 사용자 비밀번호를 수정했습니다.',
        result: {
          userId: 3,
          updatedAt: expect.any(String),
        },
      });
      expect(
        Number.isNaN(Date.parse(response.body.result.updatedAt)),
      ).toBe(false);
    });

    it('기존 비밀번호가 일치하지 않으면 PASSWORD_ERROR를 반환한다', async () => {
      passwordEncoder.matches.mockResolvedValueOnce(false);

      const response = await request(app.getHttpServer())
        .patch('/auth/v1/password')
        .set('Authorization', 'Bearer user-token')
        .send({ ...updatePasswordDto, oldPassword: 'wrong-password' })
        .expect(400);

      expect(passwordEncoder.encode).not.toHaveBeenCalled();
      expect(authMemberRepository.update).not.toHaveBeenCalled();
      expect(response.body).toEqual({
        isSuccess: false,
        code: 'AUTH400_1',
        message: '이메일 혹은 비밀번호가 틀렸습니다.',
      });
    });

    it('토큰 사용자는 존재하지만 비밀번호 조회 시 회원이 없으면 USER_NOT_FOUND를 반환한다', async () => {
      authMemberRepository.findOne
        .mockResolvedValueOnce(principalMemberFor('3'))
        .mockResolvedValueOnce(null);

      const response = await request(app.getHttpServer())
        .patch('/auth/v1/password')
        .set('Authorization', 'Bearer user-token')
        .send(updatePasswordDto)
        .expect(404);

      expect(passwordEncoder.matches).not.toHaveBeenCalled();
      expect(passwordEncoder.encode).not.toHaveBeenCalled();
      expect(authMemberRepository.update).not.toHaveBeenCalled();
      expect(response.body).toEqual({
        isSuccess: false,
        code: 'AUTH404_1',
        message: '해당 사용자를 찾을 수 없습니다.',
      });
    });

    it('비밀번호 조건부 갱신이 실패하면 PASSWORD_ERROR를 반환한다', async () => {
      authMemberRepository.update.mockResolvedValueOnce({ affected: 0 });

      const response = await request(app.getHttpServer())
        .patch('/auth/v1/password')
        .set('Authorization', 'Bearer user-token')
        .send(updatePasswordDto)
        .expect(400);

      expect(passwordEncoder.matches).toHaveBeenCalledTimes(1);
      expect(passwordEncoder.encode).toHaveBeenCalledTimes(1);
      expect(response.body).toEqual({
        isSuccess: false,
        code: 'AUTH400_1',
        message: '이메일 혹은 비밀번호가 틀렸습니다.',
      });
    });

    it('새 비밀번호가 누락되면 DB를 조회하지 않고 PASSWORD_ERROR를 반환한다', async () => {
      const response = await request(app.getHttpServer())
        .patch('/auth/v1/password')
        .set('Authorization', 'Bearer user-token')
        .send({ oldPassword: updatePasswordDto.oldPassword })
        .expect(400);

      // 첫 번째 조회는 AccessTokenGuard의 현재 사용자 조회입니다.
      expect(authMemberRepository.findOne).toHaveBeenCalledTimes(1);
      expect(passwordEncoder.matches).not.toHaveBeenCalled();
      expect(passwordEncoder.encode).not.toHaveBeenCalled();
      expect(authMemberRepository.update).not.toHaveBeenCalled();
      expect(response.body).toEqual({
        isSuccess: false,
        code: 'AUTH400_1',
        message: '이메일 혹은 비밀번호가 틀렸습니다.',
      });
    });

    it('Access Token이 없으면 TOKEN_MISSING을 반환한다', async () => {
      const response = await request(app.getHttpServer())
        .patch('/auth/v1/password')
        .send(updatePasswordDto)
        .expect(401);

      expect(authMemberRepository.findOne).not.toHaveBeenCalled();
      expect(passwordEncoder.matches).not.toHaveBeenCalled();
      expect(authMemberRepository.update).not.toHaveBeenCalled();
      expect(response.body).toEqual({
        isSuccess: false,
        code: 'AUTH401_1',
        message: '인증 토큰이 필요합니다.',
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
        role: '사원',
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

  describe('POST /admin/v1/departments', () => {
    const createDepartmentDto = { name: '신규 보안팀' };

    it('TOTAL_ADMIN은 중복을 확인하고 부서를 저장한다', async () => {
      const response = await request(app.getHttpServer())
        .post('/admin/v1/departments')
        .set('Authorization', 'Bearer total-token')
        .send(createDepartmentDto)
        .expect(201);

      expect(departmentRepository.findOne).toHaveBeenCalledWith({
        select: { departmentId: true },
        where: { departmentName: createDepartmentDto.name },
      });
      expect(adminMapper.toDepartmentDAO).toHaveBeenCalledWith({
        departmentName: createDepartmentDto.name,
      });
      expect(departmentRepository.save).toHaveBeenCalledWith({
        departmentId: '',
        departmentName: createDepartmentDto.name,
      });
      expect(response.body).toEqual({
        isSuccess: true,
        code: 'ADMIN201_2',
        message: '성공적으로 부서를 생성했습니다.',
        result: {
          name: createDepartmentDto.name,
          createdAt: expect.any(String),
        },
      });
      expect(
        Number.isNaN(Date.parse(response.body.result.createdAt)),
      ).toBe(false);
    });

    it('같은 이름의 부서가 이미 있으면 DUPLICATE_DEPARTMENT를 반환한다', async () => {
      departmentRepository.findOne.mockResolvedValueOnce(department);

      const response = await request(app.getHttpServer())
        .post('/admin/v1/departments')
        .set('Authorization', 'Bearer total-token')
        .send({ name: department.departmentName })
        .expect(400);

      expect(adminMapper.toDepartmentDAO).not.toHaveBeenCalled();
      expect(departmentRepository.save).not.toHaveBeenCalled();
      expect(response.body).toEqual({
        isSuccess: false,
        code: 'ADMIN400_2',
        message: '이미 생성된 부서입니다.',
      });
    });

    it('동시 요청으로 DB 유니크 제약에 걸려도 DUPLICATE_DEPARTMENT를 반환한다', async () => {
      departmentRepository.save.mockRejectedValueOnce(
        new QueryFailedError(
          'INSERT INTO department',
          [],
          Object.assign(new Error('duplicate department'), {
            code: 'ER_DUP_ENTRY',
            errno: 1062,
          }),
        ),
      );

      const response = await request(app.getHttpServer())
        .post('/admin/v1/departments')
        .set('Authorization', 'Bearer total-token')
        .send(createDepartmentDto)
        .expect(400);

      expect(response.body).toEqual({
        isSuccess: false,
        code: 'ADMIN400_2',
        message: '이미 생성된 부서입니다.',
      });
    });

    it('DEPART_ADMIN은 부서를 생성할 수 없다', async () => {
      const response = await request(app.getHttpServer())
        .post('/admin/v1/departments')
        .set('Authorization', 'Bearer depart-token')
        .send(createDepartmentDto)
        .expect(403);

      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(response.body).toEqual({
        isSuccess: false,
        code: 'AUTH403_1',
        message: '권한이 부족합니다.',
      });
    });

    it('공백으로만 이루어진 이름이면 INVALID_DEPARTMENT_NAME을 반환한다', async () => {
      const response = await request(app.getHttpServer())
        .post('/admin/v1/departments')
        .set('Authorization', 'Bearer total-token')
        .send({ name: '   ' })
        .expect(400);

      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(response.body).toEqual({
        isSuccess: false,
        code: 'ADMIN400_7',
        message: '부서 이름이 올바르지 않습니다.',
      });
    });

    it('255자를 초과한 이름이면 INVALID_DEPARTMENT_NAME을 반환한다', async () => {
      const response = await request(app.getHttpServer())
        .post('/admin/v1/departments')
        .set('Authorization', 'Bearer total-token')
        .send({ name: '가'.repeat(256) })
        .expect(400);

      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(response.body.code).toBe('ADMIN400_7');
    });

    it('Access Token이 없으면 TOKEN_MISSING을 반환한다', async () => {
      const response = await request(app.getHttpServer())
        .post('/admin/v1/departments')
        .send(createDepartmentDto)
        .expect(401);

      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(response.body).toEqual({
        isSuccess: false,
        code: 'AUTH401_1',
        message: '인증 토큰이 필요합니다.',
      });
    });
  });

  describe('POST /admin/v1/departments/:departmentId/apis', () => {
    const registerDto = { apiKey: 'sk-valid-key', service: 'oPeNaI' };

    it.each([
      {
        service: 'gOoGlE',
        canonicalService: 'Google',
        provider: LlmProvider.GEMINI,
        model: 'gemini-2.5-pro',
      },
      {
        service: 'oPeNaI',
        canonicalService: 'OpenAI',
        provider: LlmProvider.GPT,
        model: 'gpt-4.1',
      },
      {
        service: 'ANTHROPIC',
        canonicalService: 'Anthropic',
        provider: LlmProvider.CLAUDE,
        model: 'claude-sonnet-4',
      },
    ])(
      '$service 입력을 검증·암호화 provider로 변환하고 canonical $canonicalService 키와 모델 연결을 저장한다',
      async ({ service, canonicalService, provider, model }) => {
        llmDetailModelRepository.find.mockResolvedValueOnce([
          { llmDetailModelId: '301', llmName: model },
        ]);

        const response = await request(app.getHttpServer())
          .post('/admin/v1/departments/10/apis')
          .set('Authorization', 'Bearer total-token')
          .send({ apiKey: registerDto.apiKey, service, departmentId: 999 })
          .expect(201);

        expect(memberDepartmentRepository.findOne).not.toHaveBeenCalled();
        expect(departmentRepository.findOneBy).toHaveBeenCalledWith({
          departmentId: '10',
        });
        expect(apiKeyValidationClient.validate).toHaveBeenCalledWith(
          provider,
          registerDto.apiKey,
        );
        expect(apiKeyEncryption.encrypt).toHaveBeenCalledWith(
          registerDto.apiKey,
          '10',
          provider,
        );
        expect(dataSource.transaction).toHaveBeenCalledTimes(1);
        expect(activeApiKeyRepository.findOneBy).toHaveBeenCalledWith({
          departmentId: '10',
          serviceType: canonicalService,
        });
        expect(adminMapper.toActiveApiKeyDAO).toHaveBeenCalledWith({
          apiKey: 'v1.encrypted-api-key',
          serviceType: canonicalService,
          departmentLimit: '0',
          mustFiltering: true,
          departmentId: '10',
        });
        expect(activeApiKeyRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({
            apiKey: 'v1.encrypted-api-key',
            serviceType: canonicalService,
            departmentLimit: '0',
            mustFiltering: true,
            departmentId: '10',
          }),
        );
        expect(
          JSON.stringify(activeApiKeyRepository.save.mock.calls),
        ).not.toContain(registerDto.apiKey);
        expect(llmDetailModelRepository.find).toHaveBeenCalledWith(
          expect.objectContaining({ where: expect.anything() }),
        );
        expect(activeLlmRepository.upsert).toHaveBeenCalledWith(
          [{ activeApiKeyId: '71', llmDetailModelId: '301' }],
          expect.anything(),
        );
        expect(response.body).toEqual({
          isSuccess: true,
          code: 'ADMIN201_3',
          message: '성공적으로 부서에 API키를 생성했습니다.',
          result: {
            targetDepartment: department.departmentName,
            service: canonicalService,
            createdAt: expect.any(String),
          },
        });
      },
    );

    it('provider가 거부한 키는 저장하지 않는다', async () => {
      apiKeyValidationClient.validate.mockResolvedValueOnce(
        LlmApiKeyValidationResult.INVALID,
      );

      const response = await request(app.getHttpServer())
        .post('/admin/v1/departments/10/apis')
        .set('Authorization', 'Bearer total-token')
        .send(registerDto)
        .expect(400);

      expect(activeApiKeyRepository.save).not.toHaveBeenCalled();
      expect(activeLlmRepository.upsert).not.toHaveBeenCalled();
      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(response.body.code).toBe('ADMIN400_3');
    });

    it.each(['depart-token', 'user-token'])(
      'TOTAL_ADMIN이 아닌 사용자는 키를 등록할 수 없다 (%s)',
      async (token) => {
        const response = await request(app.getHttpServer())
          .post('/admin/v1/departments/10/apis')
          .set('Authorization', `Bearer ${token}`)
          .send(registerDto)
          .expect(403);

        expect(apiKeyValidationClient.validate).not.toHaveBeenCalled();
        expect(activeApiKeyRepository.save).not.toHaveBeenCalled();
        expect(activeLlmRepository.upsert).not.toHaveBeenCalled();
        expect(departmentRepository.findOneBy).not.toHaveBeenCalled();
        expect(memberDepartmentRepository.findOne).not.toHaveBeenCalled();
        expect(dataSource.transaction).not.toHaveBeenCalled();
        expect(response.body.code).toBe('AUTH403_1');
      },
    );

    it('존재하지 않는 부서는 provider를 호출하거나 데이터를 저장하지 않는다', async () => {
      departmentRepository.findOneBy.mockResolvedValueOnce(null);

      const response = await request(app.getHttpServer())
        .post('/admin/v1/departments/10/apis')
        .set('Authorization', 'Bearer total-token')
        .send(registerDto)
        .expect(404);

      expect(apiKeyValidationClient.validate).not.toHaveBeenCalled();
      expect(activeApiKeyRepository.save).not.toHaveBeenCalled();
      expect(activeLlmRepository.upsert).not.toHaveBeenCalled();
      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(response.body.code).toBe('ADMIN404_2');
    });

    it.each([
      { field: 'service', value: 'Azure' },
      { field: 'service', value: '  ' },
      { field: 'apiKey', value: '   ' },
      { field: 'apiKey', value: 'key\r\ninjected-header' },
    ])('$field 입력값 $value는 provider 호출 없이 거부한다', async ({ field, value }) => {
      const response = await request(app.getHttpServer())
        .post('/admin/v1/departments/10/apis')
        .set('Authorization', 'Bearer total-token')
        .send({ ...registerDto, [field]: value })
        .expect(400);

      expect(apiKeyValidationClient.validate).not.toHaveBeenCalled();
      expect(apiKeyEncryption.encrypt).not.toHaveBeenCalled();
      expect(activeApiKeyRepository.save).not.toHaveBeenCalled();
      expect(activeLlmRepository.upsert).not.toHaveBeenCalled();
      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(response.body.code).toBe('ADMIN400_3');
    });

    it('같은 부서와 service의 기존 활성 키도 무제한·강제 필터링 값으로 교체하고 모델 연결을 upsert한다', async () => {
      const existing = {
        activeApiKeyId: '7',
        apiKey: 'old-key',
        serviceType: 'OpenAI',
        departmentLimit: '100',
        mustFiltering: false,
        departmentId: '10',
      } as ActiveApiKeyDAO;
      activeApiKeyRepository.findOneBy.mockResolvedValueOnce(existing);
      llmDetailModelRepository.find.mockResolvedValueOnce([
        { llmDetailModelId: '301', llmName: 'gpt-4.1' },
      ]);

      await request(app.getHttpServer())
        .post('/admin/v1/departments/10/apis')
        .set('Authorization', 'Bearer total-token')
        .send(registerDto)
        .expect(201);

      expect(adminMapper.toActiveApiKeyDAO).not.toHaveBeenCalled();
      expect(activeApiKeyRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          activeApiKeyId: '7',
          apiKey: 'v1.encrypted-api-key',
          serviceType: 'OpenAI',
          departmentLimit: '0',
          mustFiltering: true,
        }),
      );
      expect(activeLlmRepository.upsert).toHaveBeenCalledWith(
        [{ activeApiKeyId: '7', llmDetailModelId: '301' }],
        expect.anything(),
      );
    });
  });

  describe('부서 마스킹 정책 API', () => {
    it('GET으로 부서에 설정된 정책 목록을 조회한다', async () => {
      policyRepository.find.mockResolvedValueOnce([
        {
          policyId: '3',
          maskingContent: 'PHONE',
          maskingClass: MaskingClass.PRIVATE,
        },
        {
          policyId: '8',
          maskingContent: 'API_KEY',
          maskingClass: MaskingClass.SENSITIVE,
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/api/v1/policies')
        .set('Authorization', 'Bearer user-token')
        .expect(200);

      expect(memberDepartmentRepository.findOne).toHaveBeenCalledWith({
        select: { departmentId: true },
        where: { memberId: '3' },
      });
      expect(policyRepository.find).toHaveBeenCalledWith({
        select: {
          policyId: true,
          maskingContent: true,
          maskingClass: true,
        },
        where: {
          isActive: true,
          departmentPolicies: {
            departmentId: '10',
            isActive: true,
          },
        },
        order: { policyId: 'ASC' },
      });
      expect(response.body).toEqual({
        isSuccess: true,
        code: 'USER200_3',
        message: '성공적으로 부서 정책 목록을 조회했습니다.',
        result: {
          targetDepartment: department.departmentName,
          policies: [
            { policyId: 3, maskingContent: 'PHONE', maskingClass: 'PRIVATE' },
            { policyId: 8, maskingContent: 'API_KEY', maskingClass: 'SENSITIVE' },
          ],
          totalCnt: 2,
        },
      });
    });

    it('정책이 없으면 빈 목록을 반환한다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/policies')
        .set('Authorization', 'Bearer user-token')
        .expect(200);

      expect(response.body.result).toEqual({
        targetDepartment: department.departmentName,
        policies: [],
        totalCnt: 0,
      });
    });

    it.each([
      ['depart-token', '2'],
      ['total-token', '1'],
    ])(
      '관리자도 소속 부서가 있으면 정책 목록을 조회한다 (%s)',
      async (token, memberId) => {
        const response = await request(app.getHttpServer())
          .get('/api/v1/policies')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(memberDepartmentRepository.findOne).toHaveBeenCalledWith({
          select: { departmentId: true },
          where: { memberId },
        });
        expect(policyRepository.find).toHaveBeenCalledWith(expect.objectContaining({
          where: {
            isActive: true,
            departmentPolicies: {
              departmentId: '10',
              isActive: true,
            },
          },
        }));
        expect(response.body.result).toEqual({
          targetDepartment: department.departmentName,
          policies: [],
          totalCnt: 0,
        });
      },
    );

    it('팀장은 member_department가 가리키는 자기 부서 정책만 조회한다', async () => {
      const anotherDepartment = {
        departmentId: '20',
        departmentName: '정책기획팀',
      } as DepartmentDAO;
      memberDepartmentRepository.findOne.mockResolvedValueOnce({
        memberDepartmentId: '20',
        memberId: '2',
        departmentId: anotherDepartment.departmentId,
      });
      departmentRepository.findOneBy.mockResolvedValueOnce(anotherDepartment);

      const response = await request(app.getHttpServer())
        .get('/api/v1/policies')
        .set('Authorization', 'Bearer depart-token')
        .expect(200);

      expect(departmentRepository.findOneBy).toHaveBeenCalledWith({
        departmentId: '20',
      });
      expect(policyRepository.find).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          isActive: true,
          departmentPolicies: {
            departmentId: '20',
            isActive: true,
          },
        },
      }));
      expect(response.body.result.targetDepartment).toBe('정책기획팀');
    });

    it.each(['user-token', 'depart-token', 'total-token'])(
      '소속 부서 정보가 없으면 역할과 관계없이 조회할 수 없다 (%s)',
      async (token) => {
        memberDepartmentRepository.findOne.mockResolvedValueOnce(null);

        const response = await request(app.getHttpServer())
          .get('/api/v1/policies')
          .set('Authorization', `Bearer ${token}`)
          .expect(403);

        expect(policyRepository.find).not.toHaveBeenCalled();
        expect(response.body.code).toBe('AUTH403_1');
      },
    );

    it('POST 정책 추가 API는 제거되어 있다', async () => {
      const response = await request(app.getHttpServer())
        .post('/admin/v1/departments/10/policies')
        .set('Authorization', 'Bearer depart-token')
        .send({ policies: [
          { maskingContent: 'PHONE', maskingClass: MaskingClass.PRIVATE },
        ] })
        .expect(404);

      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(response.body.code).toBe('COMMON404');
    });

    it('PUT 요청 목록을 최종 상태로 차등 동기화한다', async () => {
      const phonePolicy = {
        policyId: '3',
        maskingContent: 'PHONE',
        maskingClass: MaskingClass.PRIVATE,
        isActive: true,
      } as PolicyDAO;
      const cardPolicy = {
        policyId: '4',
        maskingContent: 'CARD',
        maskingClass: MaskingClass.PRIVATE,
        isActive: true,
      } as PolicyDAO;
      departmentPolicyRepository.find.mockResolvedValueOnce([
        {
          departmentPolicyId: '30',
          departmentId: '10',
          policyId: phonePolicy.policyId,
          isActive: true,
          policy: phonePolicy,
        },
        {
          departmentPolicyId: '40',
          departmentId: '10',
          policyId: cardPolicy.policyId,
          isActive: true,
          policy: cardPolicy,
        },
      ]);

      const response = await request(app.getHttpServer())
        .put('/admin/v1/departments/10/policies')
        .set('Authorization', 'Bearer depart-token')
        .send({
          departmentId: 999,
          policies: [
            { maskingContent: 'phone', maskingClass: MaskingClass.PRIVATE },
            { maskingContent: 'API_KEY', maskingClass: MaskingClass.SENSITIVE },
          ],
        })
        .expect(200);

      expect(memberDepartmentRepository.findOne).toHaveBeenCalledWith({
        select: { departmentId: true },
        where: { memberId: '2' },
      });
      expect(departmentRepository.findOneBy).toHaveBeenCalledWith({
        departmentId: '10',
      });
      expect(departmentRepository.findOne).toHaveBeenCalledWith({
        select: { departmentId: true },
        where: { departmentId: '10' },
        lock: { mode: 'pessimistic_write' },
      });
      expect(departmentPolicyRepository.find).toHaveBeenCalledWith({
        where: { departmentId: '10' },
        relations: { policy: true },
        order: { departmentPolicyId: 'ASC' },
      });
      expect(adminMapper.toPolicyDAO).toHaveBeenCalledTimes(1);
      expect(adminMapper.toPolicyDAO).toHaveBeenCalledWith({
        maskingContent: 'API_KEY',
        maskingClass: MaskingClass.SENSITIVE,
      });
      expect(policyRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          policyId: '',
          maskingContent: 'API_KEY',
          maskingClass: MaskingClass.SENSITIVE,
          isActive: true,
        }),
      );
      expect(departmentPolicyRepository.save).toHaveBeenCalledWith([
        expect.objectContaining({
          departmentId: '10',
          policyId: '7',
          isActive: true,
        }),
        expect.objectContaining({
          departmentPolicyId: '40',
          policyId: '4',
          isActive: false,
        }),
      ]);
      expect(response.body).toEqual({
        isSuccess: true,
        code: 'ADMIN200_19',
        message: '성공적으로 부서 정책을 동기화했습니다.',
        result: {
          targetDepartment: department.departmentName,
          policies: [
            { policyId: 3, maskingContent: 'PHONE', maskingClass: 'PRIVATE' },
            { policyId: 7, maskingContent: 'API_KEY', maskingClass: 'SENSITIVE' },
          ],
          totalCnt: 2,
        },
      });
    });

    it('동일한 최종 목록을 다시 요청하면 기존 policyId를 유지하고 쓰기를 생략한다', async () => {
      const policies = [
        {
          policyId: '3',
          maskingContent: 'PHONE',
          maskingClass: MaskingClass.PRIVATE,
          isActive: true,
        },
        {
          policyId: '8',
          maskingContent: 'API_KEY',
          maskingClass: MaskingClass.SENSITIVE,
          isActive: true,
        },
      ] as PolicyDAO[];
      departmentPolicyRepository.find.mockResolvedValueOnce(
        policies.map((policy, index) => ({
          departmentPolicyId: String(index + 1),
          departmentId: '10',
          policyId: policy.policyId,
          isActive: true,
          policy,
        })),
      );

      const response = await request(app.getHttpServer())
        .put('/admin/v1/departments/10/policies')
        .set('Authorization', 'Bearer depart-token')
        .send({ policies: [
          { maskingContent: 'PHONE', maskingClass: MaskingClass.PRIVATE },
          { maskingContent: 'API_KEY', maskingClass: MaskingClass.SENSITIVE },
        ] })
        .expect(200);

      expect(adminMapper.toPolicyDAO).not.toHaveBeenCalled();
      expect(policyRepository.save).not.toHaveBeenCalled();
      expect(departmentPolicyRepository.save).not.toHaveBeenCalled();
      expect(response.body.result).toEqual({
        targetDepartment: department.departmentName,
        policies: [
          { policyId: 3, maskingContent: 'PHONE', maskingClass: 'PRIVATE' },
          { policyId: 8, maskingContent: 'API_KEY', maskingClass: 'SENSITIVE' },
        ],
        totalCnt: 2,
      });
    });

    it('다른 부서도 사용할 수 있는 기존 정책은 새로 만들지 않고 연결만 추가한다', async () => {
      const sharedPolicy = {
        policyId: '9',
        maskingContent: 'PHONE',
        maskingClass: MaskingClass.PRIVATE,
        isActive: true,
      } as PolicyDAO;
      policyRepository.findOne.mockResolvedValueOnce(sharedPolicy);

      const response = await request(app.getHttpServer())
        .put('/admin/v1/departments/10/policies')
        .set('Authorization', 'Bearer depart-token')
        .send({ policies: [
          { maskingContent: 'PHONE', maskingClass: MaskingClass.PRIVATE },
        ] })
        .expect(200);

      expect(policyRepository.findOne).toHaveBeenCalledWith({
        where: {
          maskingContent: 'PHONE',
          maskingClass: MaskingClass.PRIVATE,
          isActive: true,
        },
        order: { policyId: 'ASC' },
      });
      expect(adminMapper.toPolicyDAO).not.toHaveBeenCalled();
      expect(policyRepository.save).not.toHaveBeenCalled();
      expect(departmentPolicyRepository.create).toHaveBeenCalledWith({
        isActive: true,
        departmentId: '10',
        policyId: '9',
        policy: sharedPolicy,
      });
      expect(departmentPolicyRepository.save).toHaveBeenCalledWith([
        expect.objectContaining({
          departmentId: '10',
          policyId: '9',
          isActive: true,
        }),
      ]);
      expect(response.body.result.policies).toEqual([
        { policyId: 9, maskingContent: 'PHONE', maskingClass: 'PRIVATE' },
      ]);
    });

    it('비활성 부서 정책 연결이 다시 요청되면 같은 policyId로 재활성화한다', async () => {
      const policy = {
        policyId: '3',
        maskingContent: 'PHONE',
        maskingClass: MaskingClass.PRIVATE,
        isActive: true,
      } as PolicyDAO;
      departmentPolicyRepository.find.mockResolvedValueOnce([
        {
          departmentPolicyId: '30',
          departmentId: '10',
          policyId: policy.policyId,
          isActive: false,
          policy,
        },
      ]);

      const response = await request(app.getHttpServer())
        .put('/admin/v1/departments/10/policies')
        .set('Authorization', 'Bearer depart-token')
        .send({ policies: [
          { maskingContent: 'PHONE', maskingClass: MaskingClass.PRIVATE },
        ] })
        .expect(200);

      expect(policyRepository.save).not.toHaveBeenCalled();
      expect(departmentPolicyRepository.save).toHaveBeenCalledWith([
        expect.objectContaining({
          departmentPolicyId: '30',
          policyId: '3',
          isActive: true,
        }),
      ]);
      expect(response.body.result.policies).toEqual([
        { policyId: 3, maskingContent: 'PHONE', maskingClass: 'PRIVATE' },
      ]);
    });

    it('maskingContent와 maskingClass가 일치하지 않으면 전체를 거부한다', async () => {
      const response = await request(app.getHttpServer())
        .put('/admin/v1/departments/10/policies')
        .set('Authorization', 'Bearer depart-token')
        .send({ policies: [
          { maskingContent: 'PHONE', maskingClass: MaskingClass.PRIVATE },
          { maskingContent: 'API_KEY', maskingClass: MaskingClass.PRIVATE },
        ] })
        .expect(400);

      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(policyRepository.save).not.toHaveBeenCalled();
      expect(response.body.code).toBe('ADMIN400_9');
    });

    it('요청 목록 내 maskingContent 중복은 거부한다', async () => {
      const response = await request(app.getHttpServer())
        .put('/admin/v1/departments/10/policies')
        .set('Authorization', 'Bearer depart-token')
        .send({ policies: [
          { maskingContent: 'PHONE', maskingClass: MaskingClass.PRIVATE },
          { maskingContent: 'phone', maskingClass: MaskingClass.PRIVATE },
        ] })
        .expect(400);

      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(policyRepository.save).not.toHaveBeenCalled();
      expect(response.body).toEqual({
        isSuccess: false,
        code: 'ADMIN400_8',
        message: '중복된 부서 정책이 요청되었습니다.',
      });
    });

    it.each([
      { caseName: '빈 목록', policies: [] },
      {
        caseName: '6개 목록',
        policies: Array.from({ length: 6 }, (_, index) => ({
          maskingContent: `UNKNOWN_${index}`,
          maskingClass: MaskingClass.PRIVATE,
        })),
      },
    ])('$caseName은 정책 목록 개수 검증에서 거부한다', async ({ policies }) => {
      const response = await request(app.getHttpServer())
        .put('/admin/v1/departments/10/policies')
        .set('Authorization', 'Bearer depart-token')
        .send({ policies })
        .expect(400);

      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(response.body.code).toBe('ADMIN400_9');
    });

    it.each(['user-token'])(
      '관리자 역할이 아니면 정책을 동기화할 수 없다 (%s)',
      async (token) => {
        const response = await request(app.getHttpServer())
          .put('/admin/v1/departments/10/policies')
          .set('Authorization', `Bearer ${token}`)
          .send({ policies: [
            { maskingContent: 'CARD', maskingClass: MaskingClass.PRIVATE },
          ] })
          .expect(403);

        expect(memberDepartmentRepository.findOne).not.toHaveBeenCalled();
        expect(dataSource.transaction).not.toHaveBeenCalled();
        expect(response.body.code).toBe('AUTH403_1');
      },
    );

    it('소속 부서 정보가 없는 DEPART_ADMIN은 정책을 동기화할 수 없다', async () => {
      memberDepartmentRepository.findOne.mockResolvedValueOnce(null);

      const response = await request(app.getHttpServer())
        .put('/admin/v1/departments/10/policies')
        .set('Authorization', 'Bearer depart-token')
        .send({ policies: [
          { maskingContent: 'CARD', maskingClass: MaskingClass.PRIVATE },
        ] })
        .expect(403);

      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(response.body.code).toBe('AUTH403_1');
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
      departmentRepository.findOne,
      departmentRepository.findOneBy,
      departmentRepository.save,
      memberRepository.findOne,
      memberRepository.findOneBy,
      memberRepository.save,
      memberDepartmentRepository.findOneBy,
      memberDepartmentRepository.findOne,
      memberDepartmentRepository.save,
      activeApiKeyRepository.findOneBy,
      activeApiKeyRepository.save,
      activeLlmRepository.upsert,
      llmDetailModelRepository.find,
      departmentPolicyRepository.create,
      departmentPolicyRepository.find,
      departmentPolicyRepository.save,
      policyRepository.findOne,
      policyRepository.findOneBy,
      policyRepository.find,
      policyRepository.delete,
      policyRepository.save,
      apiKeyValidationClient.validate,
      apiKeyEncryption.encrypt,
      apiKeyEncryption.decrypt,
      passwordEncoder.encode,
      passwordEncoder.matches,
      tokenService.issueTokenPair,
      tokenService.verifyAccessToken,
      tokenService.verifyRefreshToken,
      userMapper.toMemberDAO,
      userMapper.toMemberDepartmentDAO,
      adminMapper.toDepartmentDAO,
      adminMapper.toActiveApiKeyDAO,
      adminMapper.toPolicyDAO,
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
