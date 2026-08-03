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
import { AdminLogDAO } from '../../src/domain/admin/dao/admin-log.dao.js';
import { HealthHistoryDAO } from '../../src/domain/admin/dao/health-history.dao.js';
import { PromptLogDAO } from '../../src/domain/prompt/dao/prompt-log.dao.js';
import { MaskingDetailDAO } from '../../src/domain/prompt/dao/masking-detail.dao.js';
import {
  DEFAULT_POLICIES,
  getSecurityPolicyDisplayName,
} from '../../src/domain/admin/policy/security-policy.catalog.js';
import { AdminController } from '../../src/domain/admin/controller/admin.controller.js';
import { AdminMapper } from '../../src/domain/admin/mapper/admin.mapper.js';
import { AdminService } from '../../src/domain/admin/service/admin.service.js';
import { AuthController } from '../../src/domain/auth/controller/auth.controller.js';
import { AuthService } from '../../src/domain/auth/service/auth.service.js';
import { MemberDAO } from '../../src/domain/user/dao/member.dao.js';
import { MemberDepartmentDAO } from '../../src/domain/user/dao/member-department.dao.js';
import { MemberLimitDAO } from '../../src/domain/user/dao/member-limit.dao.js';
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
import { MinioObjectStorageService } from '../../src/global/storage/service/minio-object-storage.service.js';
import { NerConfig } from '../../src/global/ner/config/ner.config.js';
import { ProviderConfig } from '../../src/global/llm/config/provider.config.js';
import { LOCAL_LLM_MODEL } from '../../src/global/llm/llm-service.mapping.js';
import { NerClient } from '../../src/global/ner/client/ner.client.js';

describe('로그인/회원 생성 HTTP API', () => {
  const department: DepartmentDAO = {
    departmentId: '10',
    departmentName: '보안팀',
    departmentCode: 'SECURITY',
    limit: '0',
    usage: '0',
    recentUsePercent: '0',
    mustFiltering: true,
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
    authorize: UserRole.USER,
    email: 'new@example.com',
    password: 'raw-password',
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
    innerJoin: jest.fn(),
    leftJoin: jest.fn(),
    andWhere: jest.fn(),
    clone: jest.fn(),
    orderBy: jest.fn(),
    addOrderBy: jest.fn(),
    offset: jest.fn(),
    limit: jest.fn(),
    getRawMany: jest.fn(),
    getRawOne: jest.fn(),
    getOne: jest.fn(),
  };
  const departmentMemberCountQueryBuilder = {
    select: jest.fn(),
    addSelect: jest.fn(),
    where: jest.fn(),
    groupBy: jest.fn(),
    getRawMany: jest.fn(),
  };
  const departmentPolicyCountQueryBuilder = {
    select: jest.fn(),
    addSelect: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    groupBy: jest.fn(),
    getRawMany: jest.fn(),
  };
  const authMemberRepository = {
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    update: jest.fn(),
  };
  const departmentRepository = {
    find: jest.fn(),
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const departmentRiskQueryBuilder = {
    leftJoin: jest.fn(),
    select: jest.fn(),
    addSelect: jest.fn(),
    groupBy: jest.fn(),
    addGroupBy: jest.fn(),
    orderBy: jest.fn(),
    addOrderBy: jest.fn(),
    setParameter: jest.fn(),
    getRawMany: jest.fn(),
  };
  const memberRepository = {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    save: jest.fn(),
  };
  const memberDepartmentRepository = {
    createQueryBuilder: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    save: jest.fn(),
  };
  const memberLimitRepository = {
    find: jest.fn(),
    update: jest.fn(),
  };
  const activeApiKeyRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
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
    createQueryBuilder: jest.fn(),
  };
  const policyDetectQueryBuilder = {
    leftJoin: jest.fn(),
    select: jest.fn(),
    addSelect: jest.fn(),
    groupBy: jest.fn(),
    addGroupBy: jest.fn(),
    orderBy: jest.fn(),
    addOrderBy: jest.fn(),
    getRawMany: jest.fn(),
  };
  const adminLogRepository = {
    find: jest.fn(),
    save: jest.fn(),
  };
  const healthHistoryRepository = {
    create: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
  };
  const objectStorage = { isHealthy: jest.fn() };
  const nerClient = { getEnabledLlmModelNames: jest.fn() };
  const departmentPolicyRepository = {
    createQueryBuilder: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    find: jest.fn(),
    insert: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
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
    toLocalLlmActiveApiKeyDAO: jest.fn(),
  };
  const entityManager = {
    getRepository: jest.fn(),
  };
  const dataSource = {
    transaction: jest.fn(),
    getRepository: jest.fn(),
  };
  const dashboardQueryBuilder = {
    leftJoin: jest.fn(),
    select: jest.fn(),
    addSelect: jest.fn(),
    setParameters: jest.fn(),
    getRawOne: jest.fn(),
  };
  const promptLogRepository = {
    createQueryBuilder: jest.fn(),
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
          provide: getRepositoryToken(MemberLimitDAO),
          useValue: memberLimitRepository,
        },
        {
          provide: getRepositoryToken(ActiveApiKeyDAO),
          useValue: activeApiKeyRepository,
        },
        {
          provide: getRepositoryToken(DepartmentPolicyDAO),
          useValue: departmentPolicyRepository,
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
          provide: getRepositoryToken(AdminLogDAO),
          useValue: adminLogRepository,
        },
        {
          provide: getRepositoryToken(HealthHistoryDAO),
          useValue: healthHistoryRepository,
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
        { provide: MinioObjectStorageService, useValue: objectStorage },
        { provide: NerConfig, useValue: {} },
        { provide: ProviderConfig, useValue: {} },
        { provide: NerClient, useValue: nerClient },
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
    authMemberRepository.findOneBy.mockImplementation(
      async (options: { memberId: string }) => principalMemberFor(options.memberId),
    );
    authMemberRepository.count.mockResolvedValue(0);
    authMemberRepository.update.mockResolvedValue({ affected: 1 });
    for (const method of ['leftJoin', 'select', 'addSelect', 'setParameters'] as const) {
      dashboardQueryBuilder[method].mockReturnValue(dashboardQueryBuilder);
    }
    promptLogRepository.createQueryBuilder.mockReturnValue(dashboardQueryBuilder);
    dataSource.getRepository.mockImplementation((entity: unknown) => {
      if (entity === PromptLogDAO) {
        return promptLogRepository;
      }
      throw new Error('테스트에서 정의하지 않은 Repository입니다.');
    });
    dashboardQueryBuilder.getRawOne.mockResolvedValue({
      chatCnt: '0', chatRate: '0', filterDetect: '0', filterDetectRate: '0',
      maskingToGpt: '0', maskingToClaude: '0', maskingToGemini: '0',
      totalGpt: '0', totalClaude: '0', totalGemini: '0', local: '0',
      currentLocalCnt: '0', currentTotalCnt: '0',
      previousLocalCnt: '0', previousTotalCnt: '0',
    });

    passwordEncoder.matches.mockResolvedValue(true);
    passwordEncoder.encode.mockResolvedValue('$2b$12$encoded-password');
    tokenService.issueTokenPair.mockResolvedValue(tokenPair);
    tokenService.verifyAccessToken.mockImplementation(
      async (token: string): Promise<VerifiedAccessToken> =>
        verifiedAccessTokenFor(token),
    );

    departmentRepository.findOneBy.mockResolvedValue(department);
    departmentRepository.find.mockResolvedValue([]);
    departmentRepository.findAndCount.mockResolvedValue([[], 0]);
    for (const method of [
      'leftJoin', 'select', 'addSelect', 'groupBy', 'addGroupBy', 'orderBy', 'addOrderBy', 'setParameter',
    ] as const) {
      departmentRiskQueryBuilder[method].mockReturnValue(departmentRiskQueryBuilder);
    }
    departmentRiskQueryBuilder.getRawMany.mockResolvedValue([]);
    departmentRepository.createQueryBuilder.mockReturnValue(departmentRiskQueryBuilder);
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
    memberDepartmentRepository.find.mockResolvedValue([
      { memberId: '3' },
      { memberId: '4' },
    ]);
    memberLimitRepository.update.mockResolvedValue({ affected: 2 });
    memberDepartmentRepository.save.mockImplementation(
      async (relation: MemberDepartmentDAO) => relation,
    );
    for (const queryBuilder of [
      departmentMemberCountQueryBuilder,
      departmentPolicyCountQueryBuilder,
    ]) {
      queryBuilder.select.mockReturnValue(queryBuilder);
      queryBuilder.addSelect.mockReturnValue(queryBuilder);
      queryBuilder.where.mockReturnValue(queryBuilder);
      queryBuilder.groupBy.mockReturnValue(queryBuilder);
    }
    departmentPolicyCountQueryBuilder.andWhere.mockReturnValue(
      departmentPolicyCountQueryBuilder,
    );
    departmentMemberCountQueryBuilder.getRawMany.mockResolvedValue([]);
    departmentPolicyCountQueryBuilder.getRawMany.mockResolvedValue([]);
    memberDepartmentRepository.createQueryBuilder.mockReturnValue(
      departmentMemberCountQueryBuilder,
    );
    departmentPolicyRepository.createQueryBuilder.mockReturnValue(
      departmentPolicyCountQueryBuilder,
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
      (data: {
        departmentName: string;
        departmentCode: string;
        mustFiltering: boolean;
        limit: string;
      }): DepartmentDAO => ({
        departmentId: '',
        departmentName: data.departmentName,
        departmentCode: data.departmentCode,
        limit: data.limit,
        usage: '0',
        recentUsePercent: '0',
        mustFiltering: data.mustFiltering,
      }),
    );
    adminMapper.toActiveApiKeyDAO.mockImplementation(
      (data: Omit<ActiveApiKeyDAO, 'activeApiKeyId' | 'department'>) => ({
        activeApiKeyId: '',
        ...data,
      }),
    );
    adminMapper.toLocalLlmActiveApiKeyDAO.mockImplementation(
      (departmentId: string): ActiveApiKeyDAO => ({
        activeApiKeyId: '',
        apiKey: null,
        serviceType: LOCAL_LLM_MODEL,
        departmentId,
      } as ActiveApiKeyDAO),
    );
    activeApiKeyRepository.findOneBy.mockResolvedValue(null);
    activeApiKeyRepository.find.mockResolvedValue([]);
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
    nerClient.getEnabledLlmModelNames.mockResolvedValue([]);
    apiKeyValidationClient.validate.mockResolvedValue(
      LlmApiKeyValidationResult.VALID,
    );
    policyRepository.findOneBy.mockResolvedValue(null);
    policyRepository.findOne.mockResolvedValue(null);
    policyRepository.find.mockResolvedValue([]);
    for (const method of [
      'leftJoin', 'select', 'addSelect', 'groupBy', 'addGroupBy', 'orderBy', 'addOrderBy',
    ] as const) {
      policyDetectQueryBuilder[method].mockReturnValue(policyDetectQueryBuilder);
    }
    policyDetectQueryBuilder.getRawMany.mockResolvedValue([]);
    policyRepository.createQueryBuilder.mockReturnValue(policyDetectQueryBuilder);
    adminLogRepository.find.mockResolvedValue([]);
    adminLogRepository.save.mockResolvedValue({});
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
    departmentPolicyRepository.find.mockResolvedValue([]);
    departmentPolicyRepository.delete.mockResolvedValue({ affected: 0 });
    departmentPolicyRepository.insert.mockResolvedValue({ identifiers: [] });
    departmentPolicyRepository.update.mockResolvedValue({ affected: 0 });
    departmentPolicyRepository.upsert.mockResolvedValue({ identifiers: [] });
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
      if (entity === MemberLimitDAO) return memberLimitRepository;
      if (entity === ActiveApiKeyDAO) return activeApiKeyRepository;
      if (entity === ActiveLlmDAO) return activeLlmRepository;
      if (entity === LlmDetailModelDAO) return llmDetailModelRepository;
      if (entity === PolicyDAO) return policyRepository;
      if (entity === DepartmentPolicyDAO) return departmentPolicyRepository;
      if (entity === AdminLogDAO) return adminLogRepository;
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
    it('TOTAL_ADMIN은 부서 미지정 회원을 생성하고 생성 결과를 반환한다', async () => {
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
      expect(userMapper.toMemberDepartmentDAO).not.toHaveBeenCalled();
      expect(memberDepartmentRepository.save).not.toHaveBeenCalled();
      expect(response.body).toEqual({
        isSuccess: true,
        code: 'ADMIN201_1',
        message: '성공적으로 사용자를 생성했습니다.',
        result: {
          id: 20,
          name: createUserDto.name,
        },
      });
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
      });
      expect(userMapper.toMemberDepartmentDAO).toHaveBeenCalledWith({
        memberId: '20',
        departmentId: department.departmentId,
      });
      expect(memberRepository.save).toHaveBeenCalledTimes(1);
    });

    it('소속 부서가 없는 DEPART_ADMIN은 사용자를 생성할 수 없다', async () => {
      const departAdmin = createMember({
        memberId: '2',
        authorize: UserRole.DEPART_ADMIN,
      });
      memberRepository.findOneBy.mockResolvedValue(departAdmin);
      memberDepartmentRepository.findOneBy.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .post('/admin/v1/users')
        .set('Authorization', 'Bearer depart-token')
        .send({
          ...createUserDto,
          email: 'no-department@example.com',
        })
        .expect(400);

      expect(passwordEncoder.encode).not.toHaveBeenCalled();
      expect(memberRepository.save).not.toHaveBeenCalled();
      expect(response.body).toEqual({
        isSuccess: false,
        code: 'ADMIN400_4',
        message: '관리하는 부서가 아닙니다.',
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
        .send({ ...createUserDto, authorize: UserRole.DEPART_ADMIN })
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
    const createDepartmentDto = {
      name: '신규 보안팀',
      code: 'NEWSEC',
      departmentAdminId: 2,
      activeLocalLLM: true,
      mustFiltering: true,
      departmentLimit: 0,
    };
    const departmentAdmin = createMember({
      memberId: '2',
      memberName: '부서관리자',
      authorize: UserRole.DEPART_ADMIN,
    });

    it('TOTAL_ADMIN은 부서 관리자와 함께 부서를 생성한다', async () => {
      memberRepository.findOne.mockResolvedValue(departmentAdmin);
      memberDepartmentRepository.findOneBy.mockResolvedValue(null);
      nerClient.getEnabledLlmModelNames.mockResolvedValue(['qwen3:8b']);
      llmDetailModelRepository.find.mockResolvedValueOnce([
        { llmDetailModelId: '303', llmName: 'local-qwen3:8b' },
      ]);

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
        departmentCode: createDepartmentDto.code,
        mustFiltering: createDepartmentDto.mustFiltering,
        limit: '0',
      });
      expect(departmentRepository.save).toHaveBeenCalledWith({
        departmentId: '',
        departmentName: createDepartmentDto.name,
        departmentCode: createDepartmentDto.code,
        limit: '0',
        usage: '0',
        recentUsePercent: '0',
        mustFiltering: createDepartmentDto.mustFiltering,
      });
      expect(memberDepartmentRepository.save).toHaveBeenCalledWith({
        memberId: departmentAdmin.memberId,
        departmentId: '11',
      });
      expect(adminMapper.toLocalLlmActiveApiKeyDAO).toHaveBeenCalledWith('11');
      expect(activeApiKeyRepository.save).toHaveBeenCalledWith({
        activeApiKeyId: '71',
        apiKey: null,
        serviceType: LOCAL_LLM_MODEL,
        departmentId: '11',
      });
      expect(activeLlmRepository.upsert).toHaveBeenCalledWith([
        { activeApiKeyId: '71', llmDetailModelId: '303' },
      ], ['activeApiKeyId', 'llmDetailModelId']);
      expect(response.body).toEqual({
        isSuccess: true,
        code: 'ADMIN201_2',
        message: '성공적으로 부서를 생성했습니다.',
        result: {
          departmentId: 11,
          departmentName: createDepartmentDto.name,
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
        .send({ ...createDepartmentDto, name: department.departmentName })
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
      memberRepository.findOne.mockResolvedValue(departmentAdmin);
      memberDepartmentRepository.findOneBy.mockResolvedValue(null);
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

    it('부서 관리자가 아니거나 이미 다른 부서에 소속되었으면 생성하지 않는다', async () => {
      memberRepository.findOne.mockResolvedValue({
        ...departmentAdmin,
        authorize: UserRole.USER,
      });

      const response = await request(app.getHttpServer())
        .post('/admin/v1/departments')
        .set('Authorization', 'Bearer total-token')
        .send(createDepartmentDto)
        .expect(400);

      expect(departmentRepository.save).not.toHaveBeenCalled();
      expect(memberDepartmentRepository.save).not.toHaveBeenCalled();
      expect(response.body).toEqual({
        isSuccess: false,
        code: 'ADMIN400_14',
        message: '부서 관리자 지정이 올바르지 않습니다.',
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

  describe('GET /admin/v1/users', () => {
    it('총괄 관리자는 사용자 DB 필드를 권한명과 상태로 변환해 조회한다', async () => {
      const totalCountQuery = { getCount: jest.fn().mockResolvedValue(3) };
      for (const method of [
        'leftJoin',
        'andWhere',
        'orderBy',
        'addOrderBy',
        'offset',
        'limit',
      ] as const) {
        authQueryBuilder[method].mockReturnValue(authQueryBuilder);
      }
      authQueryBuilder.clone.mockReturnValueOnce(totalCountQuery);
      authQueryBuilder.getRawMany.mockResolvedValueOnce([
        {
          userId: '12',
          name: '김서윤',
          email: 'seoyun@example.com',
          department: '정책기획팀',
          authorize: UserRole.USER,
          disabledAt: null,
        },
        {
          userId: '13',
          name: '비활성사용자',
          email: 'disabled@example.com',
          department: '감사팀',
          authorize: UserRole.DEPART_ADMIN,
          disabledAt: new Date('2026-07-20T00:00:00.000Z'),
        },
        {
          userId: '1',
          name: '총괄관리자',
          email: 'total@example.com',
          department: null,
          authorize: UserRole.TOTAL_ADMIN,
          disabledAt: null,
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/admin/v1/users')
        .set('Authorization', 'Bearer total-token')
        .query({ pageSize: 10, pageNumber: 1 })
        .expect(200);

      expect(response.body).toEqual({
        isSuccess: true,
        code: 'ADMIN200_7',
        message: '성공적으로 사용자 계정 목록을 조회했습니다.',
        result: {
          data: [
            {
              userId: 12,
              name: '김서윤',
              email: 'seoyun@example.com',
              department: '정책기획팀',
              authorize: '일반 사용자',
              status: '활성',
            },
            {
              userId: 13,
              name: '비활성사용자',
              email: 'disabled@example.com',
              department: '감사팀',
              authorize: '부서 관리자',
              status: '비활성',
            },
            {
              userId: 1,
              name: '총괄관리자',
              email: 'total@example.com',
              department: null,
              authorize: '총 관리자',
              status: '활성',
            },
          ],
          totalCnt: 3,
          dataCnt: 3,
          filteringCnt: null,
          pageNumber: 1,
        },
      });
      expect(authQueryBuilder.addSelect).toHaveBeenCalledWith(
        'member.authorize',
        'authorize',
      );
      expect(authQueryBuilder.addSelect).toHaveBeenCalledWith(
        'member.disabledAt',
        'disabledAt',
      );
    });

    it('사용자가 없으면 result 전체를 null로 반환한다', async () => {
      const totalCountQuery = { getCount: jest.fn().mockResolvedValue(0) };
      for (const method of [
        'leftJoin',
        'andWhere',
        'orderBy',
        'addOrderBy',
        'offset',
        'limit',
      ] as const) {
        authQueryBuilder[method].mockReturnValue(authQueryBuilder);
      }
      authQueryBuilder.clone.mockReturnValueOnce(totalCountQuery);
      authQueryBuilder.getRawMany.mockResolvedValueOnce([]);

      const response = await request(app.getHttpServer())
        .get('/admin/v1/users')
        .set('Authorization', 'Bearer total-token')
        .query({ pageSize: 10, pageNumber: 1 })
        .expect(200);

      expect(response.body).toEqual({
        isSuccess: true,
        code: 'ADMIN200_7',
        message: '성공적으로 사용자 계정 목록을 조회했습니다.',
        result: null,
      });
    });
  });

  describe('GET /admin/v1/departments', () => {
    it.each(['total-token', 'depart-token'])(
      '%s 관리자는 부서명을 대소문자 구분 없이 검색해 페이지 응답을 조회한다',
      async (token) => {
        departmentRepository.findAndCount.mockResolvedValueOnce([
          [
            {
              departmentId: '12',
              departmentName: 'Security Operations',
              limit: '200000',
              usage: '118000',
              mustFiltering: true,
            },
          ],
          3,
        ]);
        departmentMemberCountQueryBuilder.getRawMany.mockResolvedValueOnce([
          { departmentId: '12', departmentUserCnt: '119' },
        ]);
        activeApiKeyRepository.find.mockResolvedValueOnce([
          {
            departmentId: '12',
            serviceType: 'GPT',
          },
        ]);
        departmentPolicyCountQueryBuilder.getRawMany.mockResolvedValueOnce([
          { departmentId: '12', policyCnt: '16' },
        ]);

        const response = await request(app.getHttpServer())
          .get('/admin/v1/departments')
          .set('Authorization', `Bearer ${token}`)
          .query({
            pageSize: 2,
            pageNumber: 2,
            query: ' SeCuRiTy ',
          })
          .expect(200);

        const findOptions = departmentRepository.findAndCount.mock.calls[0]?.[0] as {
          where?: {
            departmentName?: {
              type: string;
              objectLiteralParameters?: Record<string, string>;
              getSql: (columnAlias: string) => string;
            };
          };
        };
        const departmentName = findOptions.where?.departmentName;
        expect(findOptions).toMatchObject({
          select: {
            departmentId: true,
            departmentName: true,
            mustFiltering: true,
            limit: true,
            usage: true,
          },
          order: {
            departmentName: 'ASC',
            departmentId: 'ASC',
          },
          skip: 2,
          take: 2,
        });
        expect(departmentName?.type).toBe('raw');
        expect(departmentName?.objectLiteralParameters).toEqual({
          departmentName: '%security%',
        });
        expect(departmentName?.getSql('department.department_name')).toBe(
          'LOWER(department.department_name) LIKE :departmentName',
        );
        expect(response.body).toEqual({
          isSuccess: true,
          code: 'ADMIN200_17',
          message: '성공적으로 부서 목록을 조회했습니다.',
          result: {
            data: [
              {
                departmentId: 12,
                departmentName: 'Security Operations',
                departmentUserCnt: 119,
                canUseLLMModel: ['Local LLM', 'GPT'],
                policyType: '표준',
                policyCnt: 16,
                outbound: '허용',
                departLimitPercent: 59,
                departLimitUsd: 200000,
                departUseUsd: 118000,
              },
            ],
            totalCnt: 3,
            dataCnt: 1,
            pageNumber: 2,
          },
        });
      },
    );

    it('공백뿐인 검색어는 조회하지 않고 잘못된 목록 조건으로 거부한다', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/v1/departments')
        .set('Authorization', 'Bearer total-token')
        .query({ pageSize: 10, pageNumber: 1, query: '   ' })
        .expect(400);

      expect(departmentRepository.findAndCount).not.toHaveBeenCalled();
      expect(response.body).toEqual({
        isSuccess: false,
        code: 'ADMIN400_11',
        message: '부서 목록 조회 조건이 올바르지 않습니다.',
      });
    });

    it('활성 API 키가 없는 부서도 Local LLM은 사용할 수 있다', async () => {
      departmentRepository.findAndCount.mockResolvedValueOnce([
        [
          {
            departmentId: '15',
            departmentName: '미등록부서',
            limit: '0',
            usage: '0',
            mustFiltering: true,
          },
        ],
        1,
      ]);

      const response = await request(app.getHttpServer())
        .get('/admin/v1/departments')
        .set('Authorization', 'Bearer total-token')
        .query({ pageSize: 10, pageNumber: 1 })
        .expect(200);

      expect(response.body.result.data[0]).toMatchObject({
        departmentId: 15,
        canUseLLMModel: ['Local LLM'],
      });
    });

    it('조회할 부서 데이터가 없으면 result 전체를 null로 반환한다', async () => {
      departmentRepository.findAndCount.mockResolvedValueOnce([[], 0]);

      const response = await request(app.getHttpServer())
        .get('/admin/v1/departments')
        .set('Authorization', 'Bearer total-token')
        .query({ pageSize: 10, pageNumber: 1 })
        .expect(200);

      expect(response.body).toEqual({
        isSuccess: true,
        code: 'ADMIN200_17',
        message: '성공적으로 부서 목록을 조회했습니다.',
        result: null,
      });
      expect(memberDepartmentRepository.createQueryBuilder).not.toHaveBeenCalled();
      expect(activeApiKeyRepository.find).not.toHaveBeenCalled();
      expect(departmentPolicyRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('USER는 부서 목록을 조회할 수 없다', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/v1/departments')
        .set('Authorization', 'Bearer user-token')
        .query({ pageSize: 10, pageNumber: 1 })
        .expect(403);

      expect(departmentRepository.findAndCount).not.toHaveBeenCalled();
      expect(response.body.code).toBe('AUTH403_1');
    });
  });

  describe('GET /admin/v1/departments-summary', () => {
    it('부서·사용자·부서 사용량을 집계해 관리 요약을 반환한다', async () => {
      departmentRepository.find.mockResolvedValueOnce([
        {
          departmentId: '2',
          mustFiltering: false,
          limit: '100',
          usage: '25',
          recentUsePercent: '20',
        },
        {
          departmentId: '7',
          mustFiltering: true,
          limit: '100',
          usage: '50',
          recentUsePercent: '50',
        },
        {
          departmentId: '9',
          mustFiltering: false,
          limit: '0',
          usage: '10',
          recentUsePercent: '80',
        },
      ]);
      authMemberRepository.count.mockResolvedValueOnce(102);

      const response = await request(app.getHttpServer())
        .get('/admin/v1/departments-summary')
        .set('Authorization', 'Bearer total-token')
        .expect(200);

      expect(response.body).toEqual({
        isSuccess: true,
        code: 'ADMIN200_16',
        message: '성공적으로 부서 관리 요약을 조회했습니다.',
        result: {
          updatedAt: expect.any(String),
          totalDepartmentCnt: 3,
          totalUserCnt: 102,
          outboundDepartmentCnt: 2,
          averageUsePercent: 58.3,
          averageRate: 8.3,
        },
      });
      expect(Date.parse(response.body.result.updatedAt)).not.toBeNaN();
      expect(departmentRepository.find).toHaveBeenCalledWith({
        select: {
          departmentId: true,
          mustFiltering: true,
          limit: true,
          usage: true,
          recentUsePercent: true,
        },
      });
    });
  });

  describe('GET /admin/v1/dashboard', () => {
    it('운영 현황을 사용자·프롬프트·필터 감지 단위로 집계해 반환한다', async () => {
      authMemberRepository.count
        .mockResolvedValueOnce(120)
        .mockResolvedValueOnce(9);
      dashboardQueryBuilder.getRawOne.mockResolvedValueOnce({
        chatCnt: '400', chatRate: '80', filterDetect: '55', filterDetectRate: '12',
        maskingToGpt: '20', maskingToClaude: '15', maskingToGemini: '10',
        totalGpt: '120', totalClaude: '90', totalGemini: '70', local: '75',
        currentLocalCnt: '12', currentTotalCnt: '80',
        previousLocalCnt: '6', previousTotalCnt: '80',
      });

      const response = await request(app.getHttpServer())
        .get('/admin/v1/dashboard')
        .set('Authorization', 'Bearer total-token')
        .expect(200);

      expect(response.body).toMatchObject({
        isSuccess: true,
        code: 'ADMIN200_1',
        message: '성공적으로 운영 현황을 조회했습니다.',
        result: {
          updatedAt: expect.any(String),
          userCnt: 120,
          userRate: 9,
          chatCnt: 400,
          chatRate: 80,
          filterDetect: 55,
          filterDetectRate: 12,
          maskingToGpt: 20,
          maskingToClaude: 15,
          maskingToGemini: 10,
          totalGpt: 120,
          totalClaude: 90,
          totalGemini: 70,
          local: 75,
          localRate: 7.5,
        },
      });
    });
  });

  describe('GET /admin/v1/admin-logs', () => {
    it('최근 관리자 활동을 최신순으로 반환한다', async () => {
      adminLogRepository.find.mockResolvedValueOnce([
        {
          adminLogId: '8',
          logContent: '정책기획팀 보안 정책을 수정했습니다.',
          actionAt: new Date('2026-07-26T01:02:03.000Z'),
          actionMemberName: '총괄관리자',
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/admin/v1/admin-logs')
        .set('Authorization', 'Bearer total-token')
        .expect(200);

      expect(response.body).toEqual({
        isSuccess: true,
        code: 'ADMIN200_3',
        message: '성공적으로 관리자 활동 목록을 조회했습니다.',
        result: [{
          title: '정책기획팀 보안 정책을 수정했습니다.',
          activityAt: '2026-07-26T01:02:03.000Z',
          adminName: '총괄관리자',
        }],
      });
    });

    it('관리자 활동이 없으면 result 전체를 null로 반환한다', async () => {
      adminLogRepository.find.mockResolvedValueOnce([]);

      const response = await request(app.getHttpServer())
        .get('/admin/v1/admin-logs')
        .set('Authorization', 'Bearer total-token')
        .expect(200);

      expect(response.body).toEqual({
        isSuccess: true,
        code: 'ADMIN200_3',
        message: '성공적으로 관리자 활동 목록을 조회했습니다.',
        result: null,
      });
    });
  });

  describe('GET /admin/v1/policy-detect', () => {
    it('모든 보안 정책의 프롬프트 기준 감지 건수를 반환한다', async () => {
      policyDetectQueryBuilder.getRawMany.mockResolvedValueOnce([
        { category: 'PRIVATE', detailCategory: 'PHONE', count: '7' },
        { category: 'SENSITIVE', detailCategory: 'SECURITY_INFRA', count: '0' },
      ]);

      const response = await request(app.getHttpServer())
        .get('/admin/v1/policy-detect')
        .set('Authorization', 'Bearer total-token')
        .expect(200);

      expect(response.body).toEqual({
        isSuccess: true,
        code: 'ADMIN200_4',
        message: '성공적으로 정책별 감지 건수를 조회했습니다.',
        result: [
          { category: '개인정보', detailCategory: '전화번호', count: 7 },
          { category: '민감정보', detailCategory: '보안 인프라 정보', count: 0 },
        ],
      });
    });
  });

  describe('GET /admin/v1/department-risks', () => {
    it('최근 30일의 부서별 LLM 요청·사용자 수·탐지 비율을 반환한다', async () => {
      departmentRiskQueryBuilder.getRawMany.mockResolvedValueOnce([
        { departmentName: '감사팀', llmRequestCnt: '10', userCnt: '4', detectCnt: '3' },
        { departmentName: '정책기획팀', llmRequestCnt: '0', userCnt: '2', detectCnt: '0' },
      ]);

      const response = await request(app.getHttpServer())
        .get('/admin/v1/department-risks')
        .set('Authorization', 'Bearer total-token')
        .query({ recent: '30d' })
        .expect(200);

      expect(response.body).toMatchObject({
        isSuccess: true,
        code: 'ADMIN200_5',
        message: '성공적으로 부서별 위험 분포를 조회했습니다.',
        result: [
          { departmentName: '감사팀', llmRequestCnt: 10, userCnt: 4, detectRate: 30 },
          { departmentName: '정책기획팀', llmRequestCnt: 0, userCnt: 2, detectRate: 0 },
        ],
      });
    });
  });

  describe('GET /admin/v1/departments/:departmentId', () => {
    it('부서 관리자·사용량·사용 모델·활성 정책을 상세 응답으로 반환한다', async () => {
      departmentRepository.findOneBy.mockResolvedValueOnce({
        departmentId: '10',
        departmentName: '보안팀',
        limit: '100',
        usage: '75',
        mustFiltering: true,
      });
      for (const method of ['innerJoin', 'andWhere', 'orderBy'] as const) {
        authQueryBuilder[method].mockReturnValue(authQueryBuilder);
      }
      authQueryBuilder.getRawOne
        .mockResolvedValueOnce({
          name: '장우진',
          role: '감사담당관',
          authorize: UserRole.DEPART_ADMIN,
          email: 'woojin@example.com',
        })
        .mockResolvedValueOnce({ userCnt: '9' });
      activeApiKeyRepository.find.mockResolvedValueOnce([
        { serviceType: 'GPT' },
        { serviceType: 'Claude' },
        { serviceType: 'Gemini' },
      ]);
      departmentPolicyRepository.find.mockResolvedValueOnce([
        {
          departmentPolicyId: '31',
          isActive: true,
          policy: {
            policyId: '3',
            maskingContent: 'PHONE',
            maskingClass: MaskingClass.PRIVATE,
          },
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/admin/v1/departments/10')
        .set('Authorization', 'Bearer total-token')
        .expect(200);

      expect(response.body).toEqual({
        isSuccess: true,
        code: 'ADMIN200_18',
        message: '성공적으로 부서 상세정보를 조회했습니다.',
        result: {
          departmentName: '보안팀',
          departmentAdminName: '장우진',
          departmentAdminAuthorize: '부서 관리자',
          email: 'woojin@example.com',
          userCnt: 9,
          usePercent: 75,
          useUsd: 75,
          limitUsd: 100,
          remainUsd: 25,
          llmModel: [
            { modelName: 'Local LLM', hasApiKey: true },
            { modelName: 'Gemini', hasApiKey: true },
            { modelName: 'GPT', hasApiKey: true },
            { modelName: 'Claude', hasApiKey: true },
          ],
          mustFiltering: true,
          policies: [
            {
              policyId: 3,
              maskingContent: '전화번호',
              maskingClass: '개인 정보',
              isActive: true,
            },
          ],
        },
      });
    });
  });

  describe('POST /admin/v1/departments/:departmentId/apis', () => {
    const registerDto = { apiKey: 'sk-valid-key', service: 'gPt' };

    it.each([
      {
        service: 'gEmInI',
        responseService: 'Gemini',
        storedService: 'Gemini',
        provider: LlmProvider.GEMINI,
        model: 'gemini-2.5-pro',
      },
      {
        service: 'gPt',
        responseService: 'GPT',
        storedService: 'GPT',
        provider: LlmProvider.GPT,
        model: 'gpt-4.1',
      },
      {
        service: 'CLAUDE',
        responseService: 'Claude',
        storedService: 'Claude',
        provider: LlmProvider.CLAUDE,
        model: 'claude-sonnet-4',
      },
    ])(
      '$service 입력을 검증·암호화 provider로 변환하고 $storedService 키와 모델 연결을 저장한다',
      async ({ service, responseService, storedService, provider, model }) => {
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
        expect(departmentRepository.findOne).toHaveBeenCalledWith({
          select: {
            departmentId: true,
            mustFiltering: true,
            usage: true,
          },
          where: { departmentId: '10' },
          lock: { mode: 'pessimistic_write' },
        });
        expect(activeApiKeyRepository.findOneBy).toHaveBeenCalledWith({
          departmentId: '10',
          serviceType: storedService,
        });
        expect(adminMapper.toActiveApiKeyDAO).toHaveBeenCalledWith({
          apiKey: 'v1.encrypted-api-key',
          serviceType: storedService,
          departmentId: '10',
        });
        expect(activeApiKeyRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({
            apiKey: 'v1.encrypted-api-key',
            serviceType: storedService,
            departmentId: '10',
          }),
        );
        expect(departmentRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({
            departmentId: '10',
            mustFiltering: true,
            usage: '0',
          }),
        );
        expect(memberDepartmentRepository.find).toHaveBeenCalledWith({
          select: { memberId: true },
          where: { departmentId: '10' },
        });
        expect(memberLimitRepository.update).toHaveBeenCalledWith(
          { memberId: expect.anything() },
          { usage: '0' },
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
            service: responseService,
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
      { field: 'service', value: 'Google' },
      { field: 'service', value: 'OpenAI' },
      { field: 'service', value: 'Anthropic' },
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

    it('같은 부서와 service의 기존 활성 키를 교체한다', async () => {
      const existing = {
        activeApiKeyId: '7',
        apiKey: 'old-key',
        serviceType: 'GPT',
        departmentId: '10',
      } as ActiveApiKeyDAO;
      activeApiKeyRepository.findOneBy.mockResolvedValueOnce(existing);
      departmentRepository.findOne.mockResolvedValueOnce({
        ...department,
        mustFiltering: false,
      });
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
          serviceType: 'GPT',
        }),
      );
      expect(departmentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
            departmentId: '10',
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
            { policyId: 3, maskingContent: '전화번호', maskingClass: '개인 정보' },
            { policyId: 8, maskingContent: 'API 키', maskingClass: '민감 정보' },
          ],
          totalCnt: 2,
        },
      });
    });

    it('정책이 없으면 null을 반환한다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/policies')
        .set('Authorization', 'Bearer user-token')
        .expect(200);

      expect(response.body.result).toBeNull();
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
            departmentPolicies: {
              departmentId: '10',
              isActive: true,
            },
          },
        }));
        expect(response.body.result).toBeNull();
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
          departmentPolicies: {
            departmentId: '20',
            isActive: true,
          },
        },
      }));
      expect(response.body.result).toBeNull();
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

    it('TOTAL_ADMIN은 6개 문자열 정책 코드를 정규화해 기존 연결을 비활성화하고 요청 정책을 활성화한다', async () => {
      const policies = [
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
        {
          policyId: '9',
          maskingContent: 'SECURITY_INFRA',
          maskingClass: MaskingClass.SENSITIVE,
        },
        {
          policyId: '10',
          maskingContent: 'OPERATION',
          maskingClass: MaskingClass.SENSITIVE,
        },
        {
          policyId: '11',
          maskingContent: 'STATE_SECRET',
          maskingClass: MaskingClass.SENSITIVE,
        },
        {
          policyId: '12',
          maskingContent: 'CONTRACT',
          maskingClass: MaskingClass.SENSITIVE,
        },
      ] as PolicyDAO[];
      policyRepository.find.mockResolvedValueOnce(policies);
      departmentPolicyRepository.update.mockResolvedValueOnce({ affected: 2 });
      departmentPolicyRepository.upsert.mockResolvedValueOnce({ identifiers: [] });

      const response = await request(app.getHttpServer())
        .put('/admin/v1/departments/10/policies')
        .set('Authorization', 'Bearer total-token')
        .send({ policies: [
          ' phone ',
          'api_key',
          'security_infra',
          'operation',
          'state_secret',
          'contract',
        ] })
        .expect(200);

      expect(memberDepartmentRepository.findOne).not.toHaveBeenCalled();
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(departmentRepository.findOne).toHaveBeenCalledWith({
        select: { departmentId: true },
        where: { departmentId: '10' },
        lock: { mode: 'pessimistic_write' },
      });
      expect(policyRepository.find).toHaveBeenCalledWith({
        where: [
          { maskingContent: 'PHONE', maskingClass: MaskingClass.PRIVATE },
          { maskingContent: 'API_KEY', maskingClass: MaskingClass.SENSITIVE },
          {
            maskingContent: 'SECURITY_INFRA',
            maskingClass: MaskingClass.SENSITIVE,
          },
          { maskingContent: 'OPERATION', maskingClass: MaskingClass.SENSITIVE },
          {
            maskingContent: 'STATE_SECRET',
            maskingClass: MaskingClass.SENSITIVE,
          },
          { maskingContent: 'CONTRACT', maskingClass: MaskingClass.SENSITIVE },
        ],
        order: { policyId: 'ASC' },
      });
      expect(departmentPolicyRepository.update).toHaveBeenCalledWith({
        departmentId: '10',
      }, {
        isActive: false,
      });
      expect(departmentPolicyRepository.upsert).toHaveBeenCalledWith(
        policies.map((policy) => ({
          departmentId: '10',
          policyId: policy.policyId,
          isActive: true,
        })),
        ['departmentId', 'policyId'],
      );
      expect(
        departmentPolicyRepository.update.mock.invocationCallOrder[0]!,
      ).toBeLessThan(
        departmentPolicyRepository.upsert.mock.invocationCallOrder[0]!,
      );
      expect(departmentPolicyRepository.create).not.toHaveBeenCalled();
      expect(departmentPolicyRepository.find).not.toHaveBeenCalled();
      expect(departmentPolicyRepository.save).not.toHaveBeenCalled();
      expect(policyRepository.delete).not.toHaveBeenCalled();
      expect(policyRepository.findOne).not.toHaveBeenCalled();
      expect(policyRepository.findOneBy).not.toHaveBeenCalled();
      expect(policyRepository.save).not.toHaveBeenCalled();
      expect(response.body).toEqual({
        isSuccess: true,
        code: 'ADMIN200_19',
        message: '성공적으로 부서 정책을 동기화했습니다.',
        result: {
          targetDepartment: department.departmentName,
          policies: policies.map((policy) =>
            getSecurityPolicyDisplayName(policy.maskingContent)),
        },
      });
    });

    it('TOTAL_ADMIN의 빈 문자열 목록은 기존 부서 정책 연결을 모두 비활성화한다', async () => {
      departmentPolicyRepository.update.mockResolvedValueOnce({ affected: 3 });

      const response = await request(app.getHttpServer())
        .put('/admin/v1/departments/10/policies')
        .set('Authorization', 'Bearer total-token')
        .send({ policies: [] })
        .expect(200);

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(policyRepository.find).not.toHaveBeenCalled();
      expect(departmentPolicyRepository.update).toHaveBeenCalledWith({
        departmentId: '10',
      }, {
        isActive: false,
      });
      expect(departmentPolicyRepository.upsert).not.toHaveBeenCalled();
      expect(policyRepository.delete).not.toHaveBeenCalled();
      expect(policyRepository.save).not.toHaveBeenCalled();
      expect(response.body.result).toEqual({
        targetDepartment: department.departmentName,
        policies: [],
      });
    });

    it('16개의 서로 다른 정책 코드까지 모두 활성 연결로 교체할 수 있다', async () => {
      const policies: PolicyDAO[] = DEFAULT_POLICIES.map((policy, index) => ({
        policyId: String(index + 101),
        maskingContent: policy.maskingContent,
        maskingClass: policy.maskingClass === 'SENSITIVE'
          ? MaskingClass.SENSITIVE
          : MaskingClass.PRIVATE,
        isActive: true,
      }));
      policyRepository.find.mockResolvedValueOnce(policies);

      const response = await request(app.getHttpServer())
        .put('/admin/v1/departments/10/policies')
        .set('Authorization', 'Bearer total-token')
        .send({ policies: policies.map((policy) => (
          policy.maskingContent.toLowerCase()
        )) })
        .expect(200);

      expect(departmentPolicyRepository.update).toHaveBeenCalledWith({
        departmentId: '10',
      }, {
        isActive: false,
      });
      expect(departmentPolicyRepository.upsert).toHaveBeenCalledWith(
        policies.map((policy) => ({
          departmentId: '10',
          policyId: policy.policyId,
          isActive: true,
        })),
        ['departmentId', 'policyId'],
      );
      expect(response.body.result.policies).toEqual(
        policies.map((policy) =>
          getSecurityPolicyDisplayName(policy.maskingContent)),
      );
    });

    it('마스터 policy에 없는 요청 코드가 있으면 기존 부서 연결을 삭제하지 않는다', async () => {
      policyRepository.find.mockResolvedValueOnce([]);

      const response = await request(app.getHttpServer())
        .put('/admin/v1/departments/10/policies')
        .set('Authorization', 'Bearer total-token')
        .send({ policies: ['PHONE'] })
        .expect(404);

      expect(policyRepository.find).toHaveBeenCalledTimes(1);
      expect(departmentPolicyRepository.update).not.toHaveBeenCalled();
      expect(departmentPolicyRepository.upsert).not.toHaveBeenCalled();
      expect(response.body.code).toBe('ADMIN404_3');
    });

    it.each([
      ['배열이 아닌 값', 'PHONE'],
      ['객체 항목', [{ maskingContent: 'PHONE' }]],
      ['숫자 항목', [1]],
      ['null 항목', [null]],
      ['알 수 없는 코드', ['UNKNOWN_POLICY']],
      ['하이픈 별칭', ['api-key']],
      ['내부 공백 별칭', ['api key']],
    ])('%s은 정책 코드 문자열 배열로 거부한다', async (_caseName, policies) => {
      const response = await request(app.getHttpServer())
        .put('/admin/v1/departments/10/policies')
        .set('Authorization', 'Bearer total-token')
        .send({ policies })
        .expect(400);

      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(policyRepository.find).not.toHaveBeenCalled();
      expect(departmentPolicyRepository.update).not.toHaveBeenCalled();
      expect(departmentPolicyRepository.upsert).not.toHaveBeenCalled();
      expect(response.body.code).toBe('ADMIN400_9');
    });

    it('대소문자만 다른 중복 정책 코드는 비활성화·활성화 전에 거부한다', async () => {
      const response = await request(app.getHttpServer())
        .put('/admin/v1/departments/10/policies')
        .set('Authorization', 'Bearer total-token')
        .send({ policies: ['PHONE', 'phone'] })
        .expect(400);

      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(policyRepository.find).not.toHaveBeenCalled();
      expect(departmentPolicyRepository.update).not.toHaveBeenCalled();
      expect(departmentPolicyRepository.upsert).not.toHaveBeenCalled();
      expect(response.body).toEqual({
        isSuccess: false,
        code: 'ADMIN400_8',
        message: '중복된 부서 정책이 요청되었습니다.',
      });
    });

    it.each(['user-token', 'depart-token'])(
      'TOTAL_ADMIN이 아닌 역할은 부서 정책을 동기화할 수 없다 (%s)',
      async (token) => {
        const response = await request(app.getHttpServer())
          .put('/admin/v1/departments/10/policies')
          .set('Authorization', `Bearer ${token}`)
          .send({ policies: ['PHONE'] })
          .expect(403);

        expect(memberDepartmentRepository.findOne).not.toHaveBeenCalled();
        expect(dataSource.transaction).not.toHaveBeenCalled();
        expect(departmentPolicyRepository.update).not.toHaveBeenCalled();
        expect(departmentPolicyRepository.upsert).not.toHaveBeenCalled();
        expect(response.body.code).toBe('AUTH403_1');
      },
    );
  });

  function resetMocks(): void {
    const mocks = [
      authQueryBuilder.select,
      authQueryBuilder.addSelect,
      authQueryBuilder.where,
      authQueryBuilder.innerJoin,
      authQueryBuilder.leftJoin,
      authQueryBuilder.andWhere,
      authQueryBuilder.clone,
      authQueryBuilder.orderBy,
      authQueryBuilder.addOrderBy,
      authQueryBuilder.offset,
      authQueryBuilder.limit,
      authQueryBuilder.getRawMany,
      authQueryBuilder.getRawOne,
      authQueryBuilder.getOne,
      authMemberRepository.createQueryBuilder,
      authMemberRepository.count,
      authMemberRepository.findOne,
      authMemberRepository.findOneBy,
      authMemberRepository.update,
      departmentRepository.find,
      departmentRepository.findOne,
      departmentRepository.findOneBy,
      departmentRepository.findAndCount,
      departmentRepository.save,
      departmentRepository.createQueryBuilder,
      memberRepository.findOne,
      memberRepository.findOneBy,
      memberRepository.save,
      memberDepartmentRepository.findOneBy,
      memberDepartmentRepository.findOne,
      memberDepartmentRepository.save,
      memberDepartmentRepository.createQueryBuilder,
      departmentMemberCountQueryBuilder.select,
      departmentMemberCountQueryBuilder.addSelect,
      departmentMemberCountQueryBuilder.where,
      departmentMemberCountQueryBuilder.groupBy,
      departmentMemberCountQueryBuilder.getRawMany,
      departmentPolicyCountQueryBuilder.select,
      departmentPolicyCountQueryBuilder.addSelect,
      departmentPolicyCountQueryBuilder.where,
      departmentPolicyCountQueryBuilder.andWhere,
      departmentPolicyCountQueryBuilder.groupBy,
      departmentPolicyCountQueryBuilder.getRawMany,
      departmentRiskQueryBuilder.leftJoin,
      departmentRiskQueryBuilder.select,
      departmentRiskQueryBuilder.addSelect,
      departmentRiskQueryBuilder.groupBy,
      departmentRiskQueryBuilder.addGroupBy,
      departmentRiskQueryBuilder.orderBy,
      departmentRiskQueryBuilder.addOrderBy,
      departmentRiskQueryBuilder.setParameter,
      departmentRiskQueryBuilder.getRawMany,
      activeApiKeyRepository.find,
      activeApiKeyRepository.findOneBy,
      activeApiKeyRepository.save,
      activeLlmRepository.upsert,
      llmDetailModelRepository.find,
      nerClient.getEnabledLlmModelNames,
      departmentPolicyRepository.create,
      departmentPolicyRepository.createQueryBuilder,
      departmentPolicyRepository.delete,
      departmentPolicyRepository.find,
      departmentPolicyRepository.insert,
      departmentPolicyRepository.save,
      departmentPolicyRepository.update,
      departmentPolicyRepository.upsert,
      policyRepository.findOne,
      policyRepository.findOneBy,
      policyRepository.find,
      policyRepository.createQueryBuilder,
      policyRepository.delete,
      policyRepository.save,
      policyDetectQueryBuilder.leftJoin,
      policyDetectQueryBuilder.select,
      policyDetectQueryBuilder.addSelect,
      policyDetectQueryBuilder.groupBy,
      policyDetectQueryBuilder.addGroupBy,
      policyDetectQueryBuilder.orderBy,
      policyDetectQueryBuilder.addOrderBy,
      policyDetectQueryBuilder.getRawMany,
      adminLogRepository.find,
      adminLogRepository.save,
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
      adminMapper.toLocalLlmActiveApiKeyDAO,
      entityManager.getRepository,
      dataSource.transaction,
      dataSource.getRepository,
      promptLogRepository.createQueryBuilder,
      dashboardQueryBuilder.leftJoin,
      dashboardQueryBuilder.select,
      dashboardQueryBuilder.addSelect,
      dashboardQueryBuilder.setParameters,
      dashboardQueryBuilder.getRawOne,
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
