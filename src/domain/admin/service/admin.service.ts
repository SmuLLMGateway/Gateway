import { Injectable } from '@nestjs/common';
import { DataSource, IsNull, Not, QueryFailedError } from 'typeorm';
import { AdminReqDTO } from '../dto/admin.request.dto.js';
import { AdminResDTO } from '../dto/admin.response.dto.js';
import { AdminMapper } from '../mapper/admin.mapper.js';
import { AdminErrorStatus } from '../code/admin.status.js';
import { AdminException } from '../exception/admin.exception.js';
import { DepartmentDAO } from '../dao/department.dao.js';
import { MemberDAO } from '../../user/dao/member.dao.js';
import { MemberDepartmentDAO } from '../../user/dao/member-department.dao.js';
import { UserMapper } from '../../user/mapper/user.mapper.js';
import { PasswordEncoderService } from '../../../global/security/service/password-encoder.service.js';
import { UserRole } from '../../../global/security/type/user-role.enum.js';
import type { AuthenticatedUser } from '../../../global/security/type/jwt-payload.type.js';
import { SecurityException } from '../../../global/security/exception/security.exception.js';
import { SecurityErrorStatus } from '../../../global/security/code/security.status.js';
import { AuthException } from '../../auth/exception/auth.exception.js';
import { AuthErrorStatus } from '../../auth/code/auth.status.js';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActiveApiKeyDAO } from '../dao/active-api-key.dao.js';
import { LlmApiKeyValidationClient } from '../../../global/llm/client/llm-api-key-validation.client.js';
import { LlmApiKeyValidationResult } from '../../../global/llm/enum/llm-api-key-validation-result.enum.js';
import { LlmProvider } from '../../../global/llm/enum/llm-provider.enum.js';
import { ApiKeyEncryptionService } from '../../../global/llm/service/api-key-encryption.service.js';
import { MaskingClass, PolicyDAO } from '../dao/policy.dao.js';
import {
  normalizeMaskingContent,
  type MaskingContent,
} from '../../prompt/type/masking-content.type.js';
import { PromptRoomDAO } from '../../prompt/dao/prompt-room.dao.js';
import { PromptLogDAO } from '../../prompt/dao/prompt-log.dao.js';
import { MaskingDetailDAO } from '../../prompt/dao/masking-detail.dao.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_PROFILE_URL = '';
const USER_LIST_ORDER = {
  RECENT: 'recent',
  DEPARTMENT: 'department',
  ROLE: 'role',
  STATUS: 'status',
} as const;
const MAX_USER_LIST_PAGE_SIZE = 100;
const NEW_USER_PERIOD_DAYS = 7;
const MAX_DEPARTMENT_LIST_PAGE_SIZE = 100;

type UserListOrder = (typeof USER_LIST_ORDER)[keyof typeof USER_LIST_ORDER];

interface UserListQuery {
  readonly pageSize: number;
  readonly pageNumber: number;
  readonly orderBy: UserListOrder;
  readonly query?: string;
}

interface UserListRaw {
  readonly userId: string;
  readonly name: string;
  readonly email: string;
  readonly department: string;
  readonly role: UserRole;
  readonly lastLoginAt: Date | string;
  readonly disabledAt: Date | string | null;
}

interface UserSummaryRaw {
  readonly totalUserCnt: string;
  readonly activateUserCnt: string;
  readonly disabledUserCnt: string;
  readonly newUserCnt: string;
}

interface UserDetailRaw {
  readonly name: string;
  readonly email: string;
  readonly department: string;
  readonly role: UserRole;
  readonly createdAt: Date | string;
  readonly createdBy: string;
  readonly lastLoginAt: Date | string;
  readonly chatCnt: string;
  readonly filterDetectCnt: string;
  readonly masking: string;
  readonly local: string;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly passwordEncoder: PasswordEncoderService,
    private readonly userMapper: UserMapper,
    private readonly adminMapper: AdminMapper,
    @InjectRepository(MemberDAO)
    private readonly memberRepository: Repository<MemberDAO>,
    @InjectRepository(DepartmentDAO)
    private readonly departmentRepository: Repository<DepartmentDAO>,
    @InjectRepository(MemberDepartmentDAO)
    private readonly memberDepartmentRepository: Repository<MemberDepartmentDAO>,
    @InjectRepository(ActiveApiKeyDAO)
    private readonly activeApiKeyRepository: Repository<ActiveApiKeyDAO>,
    @InjectRepository(PolicyDAO)
    private readonly policyRepository: Repository<PolicyDAO>,
    private readonly apiKeyValidationClient: LlmApiKeyValidationClient,
    private readonly apiKeyEncryption: ApiKeyEncryptionService,
  ) {}

  async createUser(
    dto: AdminReqDTO.CreateUser,
    authentication: AuthenticatedUser,
  ): Promise<AdminResDTO.CreateUser> {
    return this.dataSource.transaction(async (manager) => {
      const departmentRepository = manager.getRepository(DepartmentDAO);
      const memberRepository = manager.getRepository(MemberDAO);
      const memberDepartmentRepository = manager.getRepository(MemberDepartmentDAO);

      const department = await departmentRepository.findOneBy({
        departmentName: dto.department,
      });

      if (department === null) {
        throw new AdminException(AdminErrorStatus.DEPARTMENT_NOT_FOUND);
      }

      if (!this.isValidEmail(dto.email)) {
        throw new AdminException(AdminErrorStatus.INVALID_EMAIL);
      }

      const authorize = this.toUserRole(dto.role);

      const existingMember = await memberRepository.findOne({
        select: { memberId: true },
        where: { email: dto.email },
      });

      if (existingMember !== null) {
        throw new AdminException(AdminErrorStatus.DUPLICATE_EMAIL);
      }

      const creator = await memberRepository.findOneBy({
        memberId: String(authentication.userId),
      });

      if (creator === null) {
        throw new AuthException(AuthErrorStatus.USER_NOT_FOUND);
      }

      if (creator.disabledAt !== null) {
        throw new AuthException(AuthErrorStatus.DISABLE_ACCOUNT);
      }

      if (creator.authorize === UserRole.DEPART_ADMIN) {
        const managedDepartment = await memberDepartmentRepository.findOneBy({
          memberId: creator.memberId,
          departmentId: department.departmentId,
        });

        if (managedDepartment === null) {
          throw new AdminException(AdminErrorStatus.NOT_MANAGED_DEPARTMENT);
        }
      }

      this.validateCreateRolePermission(creator.authorize, authorize);

      const now = new Date();
      const member = this.userMapper.toMemberDAO({
        memberName: dto.name,
        email: dto.email,
        password: await this.passwordEncoder.encode(dto.password),
        authorize,
        profileUrl: DEFAULT_PROFILE_URL,
        refreshToken: null,
        loginAt: now,
        createdAt: now,
        createdBy: creator.memberName,
        disabledAt: null,
      });

      try {
        const savedMember = await memberRepository.save(member);
        const memberDepartment = this.userMapper.toMemberDepartmentDAO({
          role: '사원',
          memberId: savedMember.memberId,
          departmentId: department.departmentId,
        });

        await memberDepartmentRepository.save(memberDepartment);

        return AdminMapper.toCreateUser({
          name: savedMember.memberName,
          role: this.toRoleName(savedMember.authorize),
          createdAt: savedMember.createdAt,
        });
      } catch (error: unknown) {
        if (this.isDuplicateEntry(error)) {
          throw new AdminException(AdminErrorStatus.DUPLICATE_EMAIL);
        }

        throw error;
      }
    });
  }

  async createDepartment(
    dto: AdminReqDTO.CreateDepartment,
  ): Promise<AdminResDTO.CreateDepartment> {
    const departmentName = this.normalizeDepartmentName(dto.name);

    return this.dataSource.transaction(async (manager) => {
      const departmentRepository = manager.getRepository(DepartmentDAO);
      const existingDepartment = await departmentRepository.findOne({
        select: { departmentId: true },
        where: { departmentName },
      });

      if (existingDepartment !== null) {
        throw new AdminException(AdminErrorStatus.DUPLICATE_DEPARTMENT);
      }

      const department = this.adminMapper.toDepartmentDAO({ departmentName });

      try {
        const savedDepartment = await departmentRepository.save(department);

        return AdminMapper.toCreateDepartment({
          name: savedDepartment.departmentName,
          createdAt: new Date(),
        });
      } catch (error: unknown) {
        if (this.isDuplicateEntry(error)) {
          throw new AdminException(AdminErrorStatus.DUPLICATE_DEPARTMENT);
        }

        throw error;
      }
    });
  }

  async getDepartments(
    dto: AdminReqDTO.DepartmentList,
  ): Promise<AdminResDTO.DepartmentList> {
    const pageSize = Number(dto.pageSize);
    const pageNumber = Number(dto.pageNumber);
    if (
      !Number.isSafeInteger(pageSize)
      || pageSize < 1
      || pageSize > MAX_DEPARTMENT_LIST_PAGE_SIZE
      || !Number.isSafeInteger(pageNumber)
      || pageNumber < 1
    ) {
      throw new AdminException(
        AdminErrorStatus.INVALID_DEPARTMENT_LIST_QUERY,
      );
    }

    const [departments, totalCnt] =
      await this.departmentRepository.findAndCount({
        select: {
          departmentId: true,
          departmentName: true,
        },
        order: {
          departmentName: 'ASC',
          departmentId: 'ASC',
        },
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
      });

    return AdminMapper.toDepartmentList({
      data: departments.map((department) => ({
        departmentId: Number(department.departmentId),
        departmentName: department.departmentName,
      })),
      totalCnt,
      pageNumber,
    });
  }

  async getDepartmentManagementSummary(): Promise<
    AdminResDTO.DepartmentManagementSummary
  > {
    return null as unknown as AdminResDTO.DepartmentManagementSummary;
  }

  async getDepartmentRoles(departmentId: number): Promise<unknown> {
    void departmentId;
    return null;
  }

  async getDepartmentDetail(
    departmentId: number,
  ): Promise<AdminResDTO.DepartmentDetail> {
    void departmentId;
    return null as unknown as AdminResDTO.DepartmentDetail;
  }

  async registerApiKey(
    departmentId: number,
    dto: AdminReqDTO.RegisterApiKey,
    authentication: Readonly<AuthenticatedUser>,
  ): Promise<AdminResDTO.RegisterApiKey> {
    const department = await this.findManagedDepartmentById(
      departmentId,
      authentication,
    );
    const targetDepartmentId = department.departmentId;

    const provider = this.toLlmProvider(dto.service);
    const apiKey = this.normalizeApiKey(dto.apiKey);
    const validation = await this.apiKeyValidationClient.validate(provider, apiKey);

    if (validation !== LlmApiKeyValidationResult.VALID) {
      throw new AdminException(AdminErrorStatus.INVALID_API_KEY);
    }

    const encryptedApiKey = this.apiKeyEncryption.encrypt(
      apiKey,
      targetDepartmentId,
      provider,
    );

    const existingApiKey = await this.activeApiKeyRepository.findOneBy({
      departmentId: targetDepartmentId,
      serviceType: provider,
    });
    const activeApiKey = existingApiKey ?? this.adminMapper.toActiveApiKeyDAO({
      apiKey: encryptedApiKey,
      serviceType: provider,
      departmentLimit: '0',
      departmentId: targetDepartmentId,
    });

    activeApiKey.apiKey = encryptedApiKey;
    activeApiKey.serviceType = provider;
    activeApiKey.departmentId = targetDepartmentId;
    await this.activeApiKeyRepository.save(activeApiKey);

    return AdminMapper.toRegisterApiKey({
      targetDepartment: department.departmentName,
      service: provider,
      createdAt: new Date(),
    });
  }

  async syncPolicies(
    departmentId: number,
    dto: AdminReqDTO.SyncPolicies,
    authentication: Readonly<AuthenticatedUser>,
  ): Promise<AdminResDTO.PolicyList> {
    const department = await this.findManagedDepartmentById(
      departmentId,
      authentication,
    );
    const requestedPolicies = this.normalizePolicyList(dto.policies);

    return this.dataSource.transaction(async (manager) => {
      const lockedDepartment = await manager.getRepository(DepartmentDAO).findOne({
        select: { departmentId: true },
        where: { departmentId: department.departmentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (lockedDepartment === null) {
        throw new AdminException(AdminErrorStatus.DEPARTMENT_NOT_FOUND);
      }

      const repository = manager.getRepository(PolicyDAO);
      const existingPolicies = await repository.find({
        where: { departmentId: department.departmentId },
        order: { policyId: 'ASC' },
      });
      const selectedByContent = this.selectPoliciesByContent(existingPolicies);
      const requestedContents = new Set(
        requestedPolicies.map((policy) => policy.maskingContent),
      );
      const desiredPolicies: PolicyDAO[] = [];
      const changedPolicies: PolicyDAO[] = [];

      for (const requested of requestedPolicies) {
        const existing = selectedByContent.get(requested.maskingContent);
        if (existing === undefined) {
          const created = this.adminMapper.toPolicyDAO({
            departmentId: department.departmentId,
            ...requested,
          });
          created.isActive = true;
          desiredPolicies.push(created);
          changedPolicies.push(created);
          continue;
        }

        if (!existing.isActive || existing.maskingClass !== requested.maskingClass) {
          existing.isActive = true;
          existing.maskingClass = requested.maskingClass;
          changedPolicies.push(existing);
        }
        desiredPolicies.push(existing);
      }

      for (const existing of existingPolicies) {
        const maskingContent = this.toMaskingContent(existing.maskingContent);
        const selected = selectedByContent.get(maskingContent);
        if (
          existing.isActive
          && (
            !requestedContents.has(maskingContent)
            || selected !== existing
          )
        ) {
          existing.isActive = false;
          changedPolicies.push(existing);
        }
      }

      const savedPolicies = changedPolicies.length === 0
        ? []
        : await repository.save(changedPolicies);
      const savedActiveByContent = new Map<MaskingContent, PolicyDAO>();
      for (const saved of savedPolicies) {
        if (!saved.isActive) {
          continue;
        }
        savedActiveByContent.set(
          this.toMaskingContent(saved.maskingContent),
          saved,
        );
      }

      const finalPolicies = desiredPolicies.map((policy) =>
        savedActiveByContent.get(this.toMaskingContent(policy.maskingContent))
        ?? policy,
      );
      return AdminMapper.toPolicyList(
        department.departmentName,
        finalPolicies,
      );
    });
  }

  async getPolicies(
    authentication: Readonly<AuthenticatedUser>,
  ): Promise<AdminResDTO.PolicyList> {
    const department = await this.findDepartmentByUserId(authentication.userId);
    const policies = await this.policyRepository.find({
      select: {
        policyId: true,
        maskingContent: true,
        maskingClass: true,
      },
      where: { departmentId: department.departmentId, isActive: true },
      order: { policyId: 'ASC' },
    });
    return AdminMapper.toPolicyList(department.departmentName, policies);
  }

  async getDashboard(): Promise<AdminResDTO.Dashboard> {
    return AdminMapper.toDashboard({
      updatedAt: '', userCnt: 0, userRate: 0, chatCnt: 0, chatRate: 0,
      filterDetect: 0, filterDetectRate: 0, maskingToGpt: 0,
      maskingToClaude: 0, maskingToGemini: 0, totalGpt: 0,
      totalClaude: 0, totalGemini: 0, local: 0, localRate: 0,
    });
  }

  async getTrends(dto: AdminReqDTO.Trends): Promise<AdminResDTO.Trends> {
    void dto;
    return AdminMapper.toUnknown(null);
  }

  async getAdminLogs(): Promise<AdminResDTO.AdminLogs> { return []; }
  async getPolicyDetect(): Promise<AdminResDTO.PolicyDetectList> { return []; }

  async getDepartmentRisks(
    dto: AdminReqDTO.DepartmentRisks,
  ): Promise<AdminResDTO.DepartmentRiskList> {
    void dto;
    return [];
  }

  async getUserSummary(
    authentication: Readonly<AuthenticatedUser>,
  ): Promise<AdminResDTO.UserSummary> {
    const updatedAt = new Date();
    const newUserSince = new Date(updatedAt);
    newUserSince.setUTCDate(newUserSince.getUTCDate() - NEW_USER_PERIOD_DAYS);

    const departmentId = authentication.role === UserRole.DEPART_ADMIN
      ? (await this.findDepartmentByUserId(authentication.userId)).departmentId
      : undefined;
    const queryBuilder = this.memberRepository
      .createQueryBuilder('member')
      .innerJoin(
        MemberDepartmentDAO,
        'membership',
        'membership.memberId = member.memberId',
      );

    if (departmentId !== undefined) {
      queryBuilder.andWhere('membership.departmentId = :departmentId', {
        departmentId,
      });
    }

    const summary = await queryBuilder
      .select('COUNT(member.memberId)', 'totalUserCnt')
      .addSelect(
        'SUM(CASE WHEN member.disabledAt IS NULL THEN 1 ELSE 0 END)',
        'activateUserCnt',
      )
      .addSelect(
        'SUM(CASE WHEN member.disabledAt IS NOT NULL THEN 1 ELSE 0 END)',
        'disabledUserCnt',
      )
      .addSelect(
        'SUM(CASE WHEN member.createdAt >= :newUserSince THEN 1 ELSE 0 END)',
        'newUserCnt',
      )
      .setParameter('newUserSince', newUserSince)
      .getRawOne<UserSummaryRaw>();

    return AdminMapper.toUserSummary(
      updatedAt.toISOString(),
      Number(summary?.totalUserCnt ?? 0),
      Number(summary?.activateUserCnt ?? 0),
      Number(summary?.disabledUserCnt ?? 0),
      Number(summary?.newUserCnt ?? 0),
    );
  }

  async getUsers(
    dto: AdminReqDTO.UserList,
    authentication: Readonly<AuthenticatedUser>,
  ): Promise<AdminResDTO.UserList> {
    if (authentication.role !== UserRole.TOTAL_ADMIN) {
      throw new SecurityException(SecurityErrorStatus.FORBIDDEN);
    }

    const query = this.normalizeUserListQuery(dto);

    const baseQuery = this.memberRepository
      .createQueryBuilder('member')
      .innerJoin(
        MemberDepartmentDAO,
        'membership',
        'membership.memberId = member.memberId',
      )
      .innerJoin(
        DepartmentDAO,
        'department',
        'department.departmentId = membership.departmentId',
      );

    const totalCnt = await baseQuery.clone().getCount();

    if (query.query !== undefined) {
      baseQuery.andWhere(
        '(member.memberName LIKE :query OR member.email LIKE :query)',
        { query: `%${this.escapeLikePattern(query.query)}%` },
      );
    }

    const filteringCnt = query.query === undefined
      ? null
      : await baseQuery.clone().getCount();

    this.applyUserListOrder(baseQuery, query.orderBy);
    const rows = await baseQuery
      .select('member.memberId', 'userId')
      .addSelect('member.memberName', 'name')
      .addSelect('member.email', 'email')
      .addSelect('department.departmentName', 'department')
      .addSelect('member.authorize', 'role')
      .addSelect('member.loginAt', 'lastLoginAt')
      .addSelect('member.disabledAt', 'disabledAt')
      .offset((query.pageNumber - 1) * query.pageSize)
      .limit(query.pageSize)
      .getRawMany<UserListRaw>();

    return AdminMapper.toUserList({
      data: rows.map((row) => ({
        userId: Number(row.userId),
        name: row.name,
        email: row.email,
        department: row.department,
        role: this.toRoleName(row.role),
        lastLoginAt: row.lastLoginAt,
        status: row.disabledAt === null ? '활성' : '비활성',
      })),
      totalCnt,
      filteringCnt,
      pageNumber: query.pageNumber,
    });
  }

  async getUserDetail(
    userId: number,
    authentication: Readonly<AuthenticatedUser>,
  ): Promise<AdminResDTO.UserDetail> {
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new AuthException(AuthErrorStatus.USER_NOT_FOUND);
    }

    const departmentId = authentication.role === UserRole.DEPART_ADMIN
      ? (await this.findDepartmentByUserId(authentication.userId)).departmentId
      : undefined;
    const queryBuilder = this.memberRepository
      .createQueryBuilder('member')
      .innerJoin(
        MemberDepartmentDAO,
        'membership',
        'membership.memberId = member.memberId',
      )
      .innerJoin(
        DepartmentDAO,
        'department',
        'department.departmentId = membership.departmentId',
      )
      .leftJoin(
        PromptRoomDAO,
        'promptRoom',
        'promptRoom.memberId = member.memberId',
      )
      .leftJoin(
        PromptLogDAO,
        'promptLog',
        'promptLog.promptRoomId = promptRoom.promptRoomId',
      )
      .leftJoin(
        MaskingDetailDAO,
        'maskingDetail',
        'maskingDetail.maskingReportId = promptLog.maskingReportId',
      )
      .where('member.memberId = :userId', { userId: String(userId) });

    if (departmentId !== undefined) {
      queryBuilder.andWhere('membership.departmentId = :departmentId', {
        departmentId,
      });
    }

    const detail = await queryBuilder
      .select('member.memberName', 'name')
      .addSelect('member.email', 'email')
      .addSelect('department.departmentName', 'department')
      .addSelect('member.authorize', 'role')
      .addSelect('member.createdAt', 'createdAt')
      .addSelect('member.createdBy', 'createdBy')
      .addSelect('member.loginAt', 'lastLoginAt')
      .addSelect('COUNT(DISTINCT promptLog.promptLogId)', 'chatCnt')
      .addSelect(
        'COUNT(DISTINCT CASE WHEN maskingDetail.maskingDetailId IS NOT NULL THEN promptLog.promptLogId END)',
        'filterDetectCnt',
      )
      .addSelect(
        'COUNT(DISTINCT CASE WHEN maskingDetail.originalText <> maskingDetail.maskingText THEN promptLog.promptLogId END)',
        'masking',
      )
      .addSelect(
        "COUNT(DISTINCT CASE WHEN LOWER(promptLog.modelType) = 'local' THEN promptLog.promptLogId END)",
        'local',
      )
      .groupBy('member.memberId')
      .addGroupBy('department.departmentId')
      .getRawOne<UserDetailRaw>();

    if (detail === undefined) {
      throw new AuthException(AuthErrorStatus.USER_NOT_FOUND);
    }

    return AdminMapper.toUserDetail({
      name: detail.name,
      email: detail.email,
      department: detail.department,
      role: this.toRoleName(detail.role),
      createdAt: this.toDateString(detail.createdAt),
      createdBy: detail.createdBy,
      lastLoginAt: this.toDateTimeString(detail.lastLoginAt),
      chatCnt: Number(detail.chatCnt),
      filterDetectCnt: Number(detail.filterDetectCnt),
      masking: Number(detail.masking),
      local: Number(detail.local),
    });
  }

  async disableUser(
    userId: number,
    authentication: Readonly<AuthenticatedUser>,
  ): Promise<AdminResDTO.DisableUser> {
    const member = await this.findManageableMember(userId, authentication);
    if (member.disabledAt !== null) {
      return AdminMapper.toDisableUser(
        member.memberName,
        member.disabledAt.toISOString(),
      );
    }

    const disabledAt = new Date();
    const result = await this.memberRepository.update(
      { memberId: member.memberId, disabledAt: IsNull() },
      { disabledAt, refreshToken: null },
    );
    if (result.affected !== 1) {
      const current = await this.memberRepository.findOneBy({
        memberId: member.memberId,
      });
      if (current?.disabledAt === null || current === null) {
        throw new AuthException(AuthErrorStatus.USER_NOT_FOUND);
      }
      return AdminMapper.toDisableUser(
        current.memberName,
        current.disabledAt.toISOString(),
      );
    }

    return AdminMapper.toDisableUser(
      member.memberName,
      disabledAt.toISOString(),
    );
  }

  async restoreUser(
    userId: number,
    authentication: Readonly<AuthenticatedUser>,
  ): Promise<AdminResDTO.RestoreUser> {
    const member = await this.findManageableMember(userId, authentication);
    const restoredAt = new Date();
    if (member.disabledAt !== null) {
      const result = await this.memberRepository.update(
        { memberId: member.memberId, disabledAt: Not(IsNull()) },
        { disabledAt: null },
      );
      if (result.affected !== 1) {
        const current = await this.memberRepository.findOneBy({
          memberId: member.memberId,
        });
        if (current === null) {
          throw new AuthException(AuthErrorStatus.USER_NOT_FOUND);
        }
      }
    }

    return AdminMapper.toRestoreUser(
      member.memberName,
      restoredAt.toISOString(),
    );
  }

  async updateUser(userId: number, dto: unknown): Promise<AdminResDTO.UpdateUser> {
    void userId;
    void dto;
    return AdminMapper.toUnknown(null);
  }

  async getLogsSummary(): Promise<AdminResDTO.LogsSummary> {
    return AdminMapper.toLogsSummary('', 0, 0, 0, 0);
  }

  async getUserPromptOverview(
    dto: AdminReqDTO.UserPromptOverview,
  ): Promise<AdminResDTO.UserPromptOverview> {
    void dto;
    return null as unknown as AdminResDTO.UserPromptOverview;
  }

  async getUserPromptList(
    userId: number,
    dto: AdminReqDTO.UserPromptList,
  ): Promise<AdminResDTO.UserPromptList> {
    void userId;
    void dto;
    return null as unknown as AdminResDTO.UserPromptList;
  }

  async getPromptDetail(promptId: string): Promise<AdminResDTO.PromptDetail> {
    void promptId;
    return null as unknown as AdminResDTO.PromptDetail;
  }

  async getLogs(dto: AdminReqDTO.LogList): Promise<AdminResDTO.LogList> {
    void dto;
    return AdminMapper.toLogList({
      data: [],
      totalCnt: 0,
      filteringCnt: null,
      pageNumber: 1,
    });
  }

  async getLogDetail(logId: number): Promise<AdminResDTO.LogDetail> {
    void logId;
    return AdminMapper.toUnknown(null);
  }

  private isValidEmail(email: string): boolean {
    return typeof email === 'string'
      && email.length <= 255
      && EMAIL_REGEX.test(email);
  }

  private normalizeDepartmentName(value: unknown): string {
    if (typeof value !== 'string') {
      throw new AdminException(AdminErrorStatus.INVALID_DEPARTMENT_NAME);
    }

    const departmentName = value.trim();
    if (departmentName.length === 0 || departmentName.length > 255) {
      throw new AdminException(AdminErrorStatus.INVALID_DEPARTMENT_NAME);
    }

    return departmentName;
  }

  private toUserRole(role: string): UserRole {
    switch (role) {
      case UserRole.USER:
      case '일반 사용자':
        return UserRole.USER;
      case UserRole.DEPART_ADMIN:
      case '부서 관리자':
        return UserRole.DEPART_ADMIN;
      default:
        throw new AdminException(AdminErrorStatus.INVALID_ROLE);
    }
  }

  private toLlmProvider(service: unknown): LlmProvider {
    switch (service) {
      case LlmProvider.CLAUDE:
      case LlmProvider.GPT:
      case LlmProvider.GEMINI:
        return service;
      default:
        throw new AdminException(AdminErrorStatus.INVALID_API_KEY);
    }
  }

  private normalizeApiKey(value: unknown): string {
    if (typeof value !== 'string') {
      throw new AdminException(AdminErrorStatus.INVALID_API_KEY);
    }

    const apiKey = value.trim();
    if (apiKey.length === 0 || apiKey.length > 255 || /[\r\n]/.test(apiKey)) {
      throw new AdminException(AdminErrorStatus.INVALID_API_KEY);
    }

    return apiKey;
  }

  private async findAdministrativeDepartment(
    authentication: Readonly<AuthenticatedUser>,
  ): Promise<DepartmentDAO> {
    if (
      authentication.role !== UserRole.DEPART_ADMIN
      && authentication.role !== UserRole.TOTAL_ADMIN
    ) {
      throw new SecurityException(SecurityErrorStatus.FORBIDDEN);
    }

    return this.findDepartmentByUserId(authentication.userId);
  }

  private async findManagedDepartmentById(
    departmentId: number,
    authentication: Readonly<AuthenticatedUser>,
  ): Promise<DepartmentDAO> {
    if (!Number.isSafeInteger(departmentId) || departmentId <= 0) {
      throw new AdminException(AdminErrorStatus.DEPARTMENT_NOT_FOUND);
    }
    if (
      authentication.role !== UserRole.DEPART_ADMIN
      && authentication.role !== UserRole.TOTAL_ADMIN
    ) {
      throw new SecurityException(SecurityErrorStatus.FORBIDDEN);
    }

    const department = await this.departmentRepository.findOneBy({
      departmentId: String(departmentId),
    });
    if (department === null) {
      throw new AdminException(AdminErrorStatus.DEPARTMENT_NOT_FOUND);
    }

    if (authentication.role === UserRole.DEPART_ADMIN) {
      const managedDepartment = await this.findDepartmentByUserId(
        authentication.userId,
      );
      if (managedDepartment.departmentId !== department.departmentId) {
        throw new SecurityException(SecurityErrorStatus.FORBIDDEN);
      }
    }

    return department;
  }

  private async findDepartmentForDepartmentAdmin(
    authentication: Readonly<AuthenticatedUser>,
  ): Promise<DepartmentDAO> {
    if (authentication.role !== UserRole.DEPART_ADMIN) {
      throw new SecurityException(SecurityErrorStatus.FORBIDDEN);
    }

    return this.findDepartmentByUserId(authentication.userId);
  }

  private async findDepartmentByUserId(userId: number): Promise<DepartmentDAO> {
    const membership = await this.memberDepartmentRepository.findOne({
      select: { departmentId: true },
      where: { memberId: String(userId) },
    });
    if (membership === null) {
      throw new SecurityException(SecurityErrorStatus.FORBIDDEN);
    }

    const department = await this.departmentRepository.findOneBy({
      departmentId: membership.departmentId,
    });
    if (department === null) {
      throw new AdminException(AdminErrorStatus.DEPARTMENT_NOT_FOUND);
    }
    return department;
  }

  private toMaskingContent(value: unknown): MaskingContent {
    if (typeof value !== 'string') {
      throw new AdminException(AdminErrorStatus.INVALID_POLICY);
    }
    const normalized = normalizeMaskingContent(value);
    if (normalized === null) {
      throw new AdminException(AdminErrorStatus.INVALID_POLICY);
    }
    return normalized;
  }

  private toMaskingClass(value: unknown): MaskingClass {
    switch (value) {
      case MaskingClass.SENSITIVE:
      case MaskingClass.PRIVATE:
        return value;
      default:
        throw new AdminException(AdminErrorStatus.INVALID_POLICY);
    }
  }

  private assertPolicyClassMatches(
    maskingContent: MaskingContent,
    maskingClass: MaskingClass,
  ): void {
    const expectedClass = maskingContent === 'API_KEY'
      ? MaskingClass.SENSITIVE
      : MaskingClass.PRIVATE;
    if (maskingClass !== expectedClass) {
      throw new AdminException(AdminErrorStatus.INVALID_POLICY);
    }
  }

  private normalizePolicyList(
    policies: AdminReqDTO.PolicyInput[] | string[] | undefined,
  ): Array<{ maskingContent: MaskingContent; maskingClass: MaskingClass }> {
    if (!Array.isArray(policies) || policies.length === 0 || policies.length > 5) {
      throw new AdminException(AdminErrorStatus.INVALID_POLICY);
    }

    const normalized = (policies as AdminReqDTO.PolicyInput[]).map((item) => {
      const maskingContent = this.toMaskingContent(item?.maskingContent);
      const maskingClass = this.toMaskingClass(item?.maskingClass);
      this.assertPolicyClassMatches(maskingContent, maskingClass);
      return { maskingContent, maskingClass };
    });
    if (new Set(normalized.map((item) => item.maskingContent)).size !== normalized.length) {
      throw new AdminException(AdminErrorStatus.DUPLICATE_POLICY);
    }
    return normalized;
  }

  private selectPoliciesByContent(
    policies: readonly PolicyDAO[],
  ): Map<MaskingContent, PolicyDAO> {
    const selected = new Map<MaskingContent, PolicyDAO>();

    for (const policy of policies) {
      const maskingContent = this.toMaskingContent(policy.maskingContent);
      const current = selected.get(maskingContent);
      if (current === undefined || (!current.isActive && policy.isActive)) {
        selected.set(maskingContent, policy);
      }
    }

    return selected;
  }

  private toPolicyResponse(
    policy: Readonly<PolicyDAO>,
    departmentName: string,
  ): AdminResDTO.Policy {
    return AdminMapper.toPolicy({
      policyId: policy.policyId,
      targetDepartment: departmentName,
      maskingContent: policy.maskingContent,
      maskingClass: policy.maskingClass,
      changedAt: new Date(),
    });
  }

  private validateCreateRolePermission(
    creatorRole: UserRole,
    targetRole: UserRole,
  ): void {
    if (
      creatorRole !== UserRole.TOTAL_ADMIN
      && (creatorRole !== UserRole.DEPART_ADMIN || targetRole !== UserRole.USER)
    ) {
      throw new SecurityException(SecurityErrorStatus.FORBIDDEN);
    }
  }

  private toRoleName(role: UserRole): string {
    switch (role) {
      case UserRole.USER:
        return '일반 사용자';
      case UserRole.DEPART_ADMIN:
        return '부서 관리자';
      case UserRole.TOTAL_ADMIN:
        return '총괄 관리자';
    }
  }

  private normalizeUserListQuery(dto: AdminReqDTO.UserList): UserListQuery {
    const pageSize = Number(dto.pageSize);
    const pageNumber = Number(dto.pageNumber);
    if (
      !Number.isSafeInteger(pageSize)
      || pageSize < 1
      || pageSize > MAX_USER_LIST_PAGE_SIZE
      || !Number.isSafeInteger(pageNumber)
      || pageNumber < 1
    ) {
      throw new AdminException(AdminErrorStatus.INVALID_USER_LIST_QUERY);
    }

    if (dto.orderBy !== undefined && dto.query !== undefined) {
      throw new AdminException(AdminErrorStatus.INVALID_USER_LIST_QUERY);
    }

    const orderBy = dto.orderBy ?? USER_LIST_ORDER.RECENT;
    if (!Object.values(USER_LIST_ORDER).includes(orderBy as UserListOrder)) {
      throw new AdminException(AdminErrorStatus.INVALID_USER_LIST_QUERY);
    }

    const query = dto.query?.trim();
    if (dto.query !== undefined && (query === undefined || query.length === 0)) {
      throw new AdminException(AdminErrorStatus.INVALID_USER_LIST_QUERY);
    }

    return {
      pageSize,
      pageNumber,
      orderBy: orderBy as UserListOrder,
      ...(query === undefined ? {} : { query }),
    };
  }

  private applyUserListOrder(
    queryBuilder: ReturnType<Repository<MemberDAO>['createQueryBuilder']>,
    orderBy: UserListOrder,
  ): void {
    switch (orderBy) {
      case USER_LIST_ORDER.RECENT:
        queryBuilder.orderBy('member.createdAt', 'DESC');
        break;
      case USER_LIST_ORDER.DEPARTMENT:
        queryBuilder.orderBy('department.departmentName', 'ASC');
        break;
      case USER_LIST_ORDER.ROLE:
        queryBuilder.orderBy('member.authorize', 'ASC');
        break;
      case USER_LIST_ORDER.STATUS:
        queryBuilder.orderBy('member.disabledAt', 'ASC');
        break;
    }
    queryBuilder.addOrderBy('member.memberId', 'DESC');
  }

  private escapeLikePattern(value: string): string {
    return value.replace(/[\\%_]/g, '\\$&');
  }

  private toDateString(value: Date | string): string {
    return (value instanceof Date ? value.toISOString() : value).slice(0, 10);
  }

  private toDateTimeString(value: Date | string): string {
    return value instanceof Date ? value.toISOString() : value;
  }

  private async findManageableMember(
    userId: number,
    authentication: Readonly<AuthenticatedUser>,
  ): Promise<MemberDAO> {
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new AuthException(AuthErrorStatus.USER_NOT_FOUND);
    }

    const membership = await this.memberDepartmentRepository.findOne({
      select: { departmentId: true },
      where: { memberId: String(userId) },
    });
    const member = await this.memberRepository.findOneBy({
      memberId: String(userId),
    });
    if (membership === null || member === null) {
      throw new AuthException(AuthErrorStatus.USER_NOT_FOUND);
    }

    if (authentication.role === UserRole.DEPART_ADMIN) {
      const department = await this.findDepartmentByUserId(authentication.userId);
      if (membership.departmentId !== department.departmentId) {
        throw new AuthException(AuthErrorStatus.USER_NOT_FOUND);
      }
      if (member.authorize !== UserRole.USER) {
        throw new SecurityException(SecurityErrorStatus.FORBIDDEN);
      }
      return member;
    }

    if (
      authentication.role !== UserRole.TOTAL_ADMIN
      || member.authorize === UserRole.TOTAL_ADMIN
    ) {
      throw new SecurityException(SecurityErrorStatus.FORBIDDEN);
    }

    return member;
  }

  private isDuplicateEntry(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const driverError = error.driverError as { code?: string; errno?: number };
    return driverError.code === 'ER_DUP_ENTRY' || driverError.errno === 1062;
  }
}
