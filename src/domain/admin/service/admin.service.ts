import { Injectable } from '@nestjs/common';
import {
  DataSource,
  In,
  IsNull,
  MoreThanOrEqual,
  Not,
  QueryFailedError,
  Raw,
} from 'typeorm';
import { AdminReqDTO } from '../dto/admin.request.dto.js';
import { AdminResDTO } from '../dto/admin.response.dto.js';
import { AdminData } from '../data/admin.data.js';
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
import { ActiveLlmDAO } from '../dao/active-llm.dao.js';
import { LlmDetailModelDAO } from '../dao/llm-detail-model.dao.js';
import { LlmApiKeyValidationClient } from '../../../global/llm/client/llm-api-key-validation.client.js';
import { LlmApiKeyValidationResult } from '../../../global/llm/enum/llm-api-key-validation-result.enum.js';
import { LlmService } from '../../../global/llm/enum/llm-service.enum.js';
import {
  getLlmServiceDescriptor,
  normalizeLlmService,
} from '../../../global/llm/llm-service.mapping.js';
import { ApiKeyEncryptionService } from '../../../global/llm/service/api-key-encryption.service.js';
import { MaskingClass, PolicyDAO } from '../dao/policy.dao.js';
import { DepartmentPolicyDAO } from '../dao/department-policy.dao.js';
import {
  getDefaultPolicy,
  SECURITY_POLICY_CONTENTS,
  type SecurityPolicyContent,
} from '../policy/security-policy.catalog.js';
import { PromptRoomDAO } from '../../prompt/dao/prompt-room.dao.js';
import { PromptLogDAO } from '../../prompt/dao/prompt-log.dao.js';
import { MaskingDetailDAO } from '../../prompt/dao/masking-detail.dao.js';
import { AdminLogDAO } from '../dao/admin-log.dao.js';

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
const MAX_DEPARTMENT_NAME_LENGTH = 255;

type UserListOrder = (typeof USER_LIST_ORDER)[keyof typeof USER_LIST_ORDER];

interface UserListQuery {
  readonly pageSize: number;
  readonly pageNumber: number;
  readonly orderBy: UserListOrder;
  readonly query?: string;
}

interface DepartmentListQuery {
  readonly pageSize: number;
  readonly pageNumber: number;
  readonly query?: string;
}

interface DepartmentMemberCountRaw {
  readonly departmentId: string;
  readonly departmentUserCnt: string;
}

interface DepartmentPolicyCountRaw {
  readonly departmentId: string;
  readonly policyCnt: string;
}

interface DepartmentQuota {
  readonly departLimitPercent: number;
  readonly departLimitUsd: number;
  readonly departUseUsd: number;
}

interface DepartmentAdminRaw {
  readonly name: string;
  readonly role: string;
  readonly authorize: UserRole;
  readonly email: string;
}

interface DepartmentUserCountRaw {
  readonly userCnt: string;
}

interface DepartmentDetailUsageMetrics {
  readonly usePercent: number;
  readonly useUsd: number;
  readonly limitUsd: number;
  readonly remainUsd: number;
}

interface UserListRaw {
  readonly userId: string;
  readonly name: string;
  readonly email: string;
  readonly department: string | null;
  readonly authorize: UserRole;
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

interface DashboardRaw {
  readonly chatCnt: string;
  readonly chatRate: string;
  readonly filterDetect: string;
  readonly filterDetectRate: string;
  readonly maskingToGpt: string;
  readonly maskingToClaude: string;
  readonly maskingToGemini: string;
  readonly totalGpt: string;
  readonly totalClaude: string;
  readonly totalGemini: string;
  readonly local: string;
  readonly currentLocalCnt: string;
  readonly currentTotalCnt: string;
  readonly previousLocalCnt: string;
  readonly previousTotalCnt: string;
}

interface PolicyDetectRaw {
  readonly category: MaskingClass;
  readonly detailCategory: string;
  readonly count: string;
}

interface DepartmentRiskRaw {
  readonly departmentName: string;
  readonly llmRequestCnt: string;
  readonly userCnt: string;
  readonly detectCnt: string;
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
    @InjectRepository(DepartmentPolicyDAO)
    private readonly departmentPolicyRepository: Repository<DepartmentPolicyDAO>,
    @InjectRepository(PolicyDAO)
    private readonly policyRepository: Repository<PolicyDAO>,
    @InjectRepository(AdminLogDAO)
    private readonly adminLogRepository: Repository<AdminLogDAO>,
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
      const adminLogRepository = manager.getRepository(AdminLogDAO);

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

        await adminLogRepository.save({
          logContent: `${savedMember.memberName} 사용자 계정을 생성했습니다.`,
          actionAt: new Date(),
          actionMemberName: creator.memberName,
        });

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
  ): Promise<AdminResDTO.DepartmentList | null> {
    const query = this.normalizeDepartmentListQuery(dto);

    const [departments, totalCnt] =
      await this.departmentRepository.findAndCount({
        select: {
          departmentId: true,
          departmentName: true,
          mustFiltering: true,
        },
        order: {
          departmentName: 'ASC',
          departmentId: 'ASC',
        },
        ...(query.query === undefined
          ? {}
          : {
            where: {
              departmentName: Raw(
                (columnAlias) => `LOWER(${columnAlias}) LIKE :departmentName`,
                {
                  departmentName:
                    `%${this.escapeLikePattern(query.query.toLowerCase())}%`,
                },
              ),
            },
          }),
        skip: (query.pageNumber - 1) * query.pageSize,
        take: query.pageSize,
      });

    if (departments.length === 0) {
      return null;
    }

    return AdminMapper.toDepartmentList({
      data: await this.toDepartmentListItems(departments),
      totalCnt,
      pageNumber: query.pageNumber,
    });
  }

  /**
   * 페이지에 포함된 부서만 대상으로 관련 통계를 일괄 조회합니다.
   *
   * 사용자·API 키·정책을 한 쿼리에 직접 조인하면 관계별 행 수가 곱해져 집계가
   * 부풀어 오르므로, 각 관계를 독립적으로 집계한 뒤 메모리에서 결합합니다.
   */
  private async toDepartmentListItems(
    departments: readonly DepartmentDAO[],
  ): Promise<AdminData.DepartmentListItem[]> {
    if (departments.length === 0) {
      return [];
    }

    const departmentIds = departments.map((department) => department.departmentId);
    const [memberCounts, activeApiKeys, policyCounts] = await Promise.all([
      this.memberDepartmentRepository
        .createQueryBuilder('memberDepartment')
        .select('memberDepartment.departmentId', 'departmentId')
        .addSelect(
          'COUNT(DISTINCT memberDepartment.memberId)',
          'departmentUserCnt',
        )
        .where('memberDepartment.departmentId IN (:...departmentIds)', {
          departmentIds,
        })
        .groupBy('memberDepartment.departmentId')
        .getRawMany<DepartmentMemberCountRaw>(),
      this.activeApiKeyRepository.find({
        select: {
          departmentId: true,
          serviceType: true,
          limit: true,
          usage: true,
        },
        where: { departmentId: In(departmentIds) },
        order: { serviceType: 'ASC' },
      }),
      this.departmentPolicyRepository
        .createQueryBuilder('departmentPolicy')
        .select('departmentPolicy.departmentId', 'departmentId')
        .addSelect(
          'COUNT(DISTINCT departmentPolicy.policyId)',
          'policyCnt',
        )
        .where('departmentPolicy.departmentId IN (:...departmentIds)', {
          departmentIds,
        })
        .andWhere('departmentPolicy.isActive = :isActive', { isActive: true })
        .groupBy('departmentPolicy.departmentId')
        .getRawMany<DepartmentPolicyCountRaw>(),
    ]);

    const memberCountByDepartment = new Map(
      memberCounts.map((item) => [
        item.departmentId,
        Number(item.departmentUserCnt),
      ]),
    );
    const policyCountByDepartment = new Map(
      policyCounts.map((item) => [item.departmentId, Number(item.policyCnt)]),
    );
    const activeApiKeysByDepartment = this.groupActiveApiKeysByDepartment(
      activeApiKeys,
    );

    return departments.map((department) => {
      const activeApiKeys = activeApiKeysByDepartment.get(department.departmentId)
        ?? [];
      const policyCnt = policyCountByDepartment.get(department.departmentId) ?? 0;
      const quota = this.toDepartmentQuota(activeApiKeys);

      return {
        departmentId: Number(department.departmentId),
        departmentName: department.departmentName,
        departmentUserCnt:
          memberCountByDepartment.get(department.departmentId) ?? 0,
        canUseLLMModel: this.toAvailableLlmServices(activeApiKeys),
        policyType: policyCnt === SECURITY_POLICY_CONTENTS.length
          ? '표준'
          : '커스텀',
        policyCnt,
        outbound: department.mustFiltering ? '허용' : '불가',
        ...quota,
      };
    });
  }

  /**
   * 목록 응답의 USD 필드는 스칼라이므로 부서의 활성 서비스 값을 합산합니다.
   * 서비스 한도 중 하나라도 0이면 부서 한도를 0(무제한)으로 표현합니다.
   */
  private toDepartmentQuota(
    activeApiKeys: readonly ActiveApiKeyDAO[],
  ): DepartmentQuota {
    let totalLimit = 0n;
    let totalUsage = 0n;
    let hasUnlimitedLimit = false;

    for (const activeApiKey of activeApiKeys) {
      const limit = BigInt(activeApiKey.limit);
      totalUsage += BigInt(activeApiKey.usage);

      if (limit === 0n) {
        hasUnlimitedLimit = true;
      } else {
        totalLimit += limit;
      }
    }

    const isUnlimited = hasUnlimitedLimit || totalLimit === 0n;
    return {
      departLimitPercent: isUnlimited
        ? 100
        : Number((totalUsage * 100n + totalLimit / 2n) / totalLimit),
      departLimitUsd: isUnlimited ? 0 : Number(totalLimit),
      departUseUsd: Number(totalUsage),
    };
  }

  private toDepartmentDetailUsageMetrics(
    activeApiKeys: readonly ActiveApiKeyDAO[],
  ): DepartmentDetailUsageMetrics {
    if (activeApiKeys.length === 0) {
      return {
        usePercent: 0,
        useUsd: 0,
        limitUsd: 0,
        remainUsd: 0,
      };
    }

    const serviceMetrics = activeApiKeys.map((activeApiKey) => {
      const limit = BigInt(activeApiKey.limit);
      const usage = BigInt(activeApiKey.usage);
      const isUnlimited = limit === 0n;

      return {
        usePercent: isUnlimited
          ? 100
          : Number((usage * 100n + limit / 2n) / limit),
        useUsd: Number(usage),
        limitUsd: Number(limit),
        remainUsd: isUnlimited || usage >= limit ? 0 : Number(limit - usage),
      };
    });

    return {
      usePercent: this.toAveragePercent(
        serviceMetrics.map((metric) => metric.usePercent),
      ),
      useUsd: this.toAveragePercent(
        serviceMetrics.map((metric) => metric.useUsd),
      ),
      limitUsd: this.toAveragePercent(
        serviceMetrics.map((metric) => metric.limitUsd),
      ),
      remainUsd: this.toAveragePercent(
        serviceMetrics.map((metric) => metric.remainUsd),
      ),
    };
  }

  private toDepartmentLlmModels(
    activeApiKeys: readonly ActiveApiKeyDAO[],
  ): AdminResDTO.DepartmentLlmModel[] {
    const services = this.toAvailableLlmServices(activeApiKeys) ?? [];

    return [
      { modelName: 'Local LLM', hasApiKey: true },
      ...services
        .filter((service) => service !== 'Local LLM')
        .map((service) => ({ modelName: service, hasApiKey: true })),
    ];
  }

  private groupActiveApiKeysByDepartment(
    activeApiKeys: readonly ActiveApiKeyDAO[],
  ): Map<string, ActiveApiKeyDAO[]> {
    const activeApiKeysByDepartment = new Map<string, ActiveApiKeyDAO[]>();
    for (const activeApiKey of activeApiKeys) {
      const departmentActiveApiKeys = activeApiKeysByDepartment.get(
        activeApiKey.departmentId,
      );
      if (departmentActiveApiKeys === undefined) {
        activeApiKeysByDepartment.set(activeApiKey.departmentId, [activeApiKey]);
      } else {
        departmentActiveApiKeys.push(activeApiKey);
      }
    }
    return activeApiKeysByDepartment;
  }

  private toAveragePercent(percentages: readonly number[]): number {
    if (percentages.length === 0) {
      return 0;
    }
    return this.roundToOneDecimal(
      percentages.reduce((total, percent) => total + percent, 0)
        / percentages.length,
    );
  }

  private toRatioPercent(numerator: number, denominator: number): number {
    if (denominator === 0) {
      return 0;
    }
    return this.roundToOneDecimal((numerator / denominator) * 100);
  }

  private toUsePercentDifference(
    previousAverageUsePercent: number,
    averageUsePercent: number,
  ): number {
    return this.roundToOneDecimal(
      averageUsePercent - previousAverageUsePercent,
    );
  }

  private roundToOneDecimal(value: number): number {
    return Math.round(value * 10) / 10;
  }

  private toAvailableLlmServices(
    activeApiKeys: readonly ActiveApiKeyDAO[],
  ): string[] | null {
    const serviceTypes = new Set(
      activeApiKeys.map((activeApiKey) => activeApiKey.serviceType),
    );
    const canonicalServices = Object.values(LlmService).filter((service) =>
      serviceTypes.has(service),
    );
    const additionalServices = [...serviceTypes]
      .filter((service) => !canonicalServices.includes(service as LlmService))
      .sort((left, right) => left.localeCompare(right));

    const services = [...canonicalServices, ...additionalServices];
    return services.length === 0 ? null : services;
  }

  async getDepartmentManagementSummary(): Promise<
    AdminResDTO.DepartmentManagementSummary
  > {
    const [departments, totalUserCnt, activeApiKeys] = await Promise.all([
      this.departmentRepository.find({
        select: {
          departmentId: true,
          mustFiltering: true,
        },
      }),
      this.memberRepository.count(),
      this.activeApiKeyRepository.find({
        select: {
          departmentId: true,
          limit: true,
          usage: true,
          recentUsePercent: true,
        },
      }),
    ]);
    const activeApiKeysByDepartment = this.groupActiveApiKeysByDepartment(
      activeApiKeys,
    );
    const averageUsePercent = this.toAveragePercent(
      departments.map((department) => this.toDepartmentQuota(
        activeApiKeysByDepartment.get(department.departmentId) ?? [],
      ).departLimitPercent),
    );
    const averageRecentUsePercent = this.toAveragePercent(
      activeApiKeys.map((activeApiKey) => Number(
        activeApiKey.recentUsePercent ?? '0',
      )),
    );

    return AdminMapper.toDepartmentManagementSummary({
      updatedAt: new Date(),
      totalDepartmentCnt: departments.length,
      totalUserCnt,
      outboundDepartmentCnt: departments.filter(
        (department) => !department.mustFiltering,
      ).length,
      averageUsePercent,
      averageRate: this.toUsePercentDifference(
        averageRecentUsePercent,
        averageUsePercent,
      ),
    });
  }

  async getDepartmentRoles(departmentId: number): Promise<unknown> {
    void departmentId;
    return null;
  }

  async getDepartmentDetail(
    departmentId: number,
  ): Promise<AdminResDTO.DepartmentDetail> {
    if (!Number.isSafeInteger(departmentId) || departmentId <= 0) {
      throw new AdminException(AdminErrorStatus.DEPARTMENT_NOT_FOUND);
    }

    const department = await this.departmentRepository.findOneBy({
      departmentId: String(departmentId),
    });
    if (department === null) {
      throw new AdminException(AdminErrorStatus.DEPARTMENT_NOT_FOUND);
    }

    const [departmentAdmin, userCount, activeApiKeys, policies] =
      await Promise.all([
        this.memberRepository
          .createQueryBuilder('member')
          .innerJoin(
            MemberDepartmentDAO,
            'membership',
            'membership.memberId = member.memberId',
          )
          .select('member.memberName', 'name')
          .addSelect('membership.role', 'role')
          .addSelect('member.authorize', 'authorize')
          .addSelect('member.email', 'email')
          .where('membership.departmentId = :departmentId', {
            departmentId: department.departmentId,
          })
          .andWhere('member.authorize = :departmentAdminRole', {
            departmentAdminRole: UserRole.DEPART_ADMIN,
          })
          .orderBy('membership.memberDepartmentId', 'ASC')
          .getRawOne<DepartmentAdminRaw>(),
        this.memberRepository
          .createQueryBuilder('member')
          .innerJoin(
            MemberDepartmentDAO,
            'membership',
            'membership.memberId = member.memberId',
          )
          .select('COUNT(DISTINCT member.memberId)', 'userCnt')
          .where('membership.departmentId = :departmentId', {
            departmentId: department.departmentId,
          })
          .andWhere('member.authorize = :userRole', {
            userRole: UserRole.USER,
          })
          .getRawOne<DepartmentUserCountRaw>(),
        this.activeApiKeyRepository.find({
          select: {
            serviceType: true,
            limit: true,
            usage: true,
          },
          where: { departmentId: department.departmentId },
          order: { serviceType: 'ASC' },
        }),
        this.policyRepository.find({
          select: {
            policyId: true,
            maskingContent: true,
            maskingClass: true,
          },
          where: {
            departmentPolicies: {
              departmentId: department.departmentId,
              isActive: true,
            },
          },
          order: { policyId: 'ASC' },
        }),
      ]);
    const metrics = this.toDepartmentDetailUsageMetrics(activeApiKeys);

    return AdminMapper.toDepartmentDetail({
      departmentName: department.departmentName,
      departmentAdminName: departmentAdmin?.name ?? null,
      departmentAdminRole: departmentAdmin?.role ?? null,
      departmentAdminAuthorize: departmentAdmin === undefined
        ? null
        : this.toRoleName(departmentAdmin.authorize),
      email: departmentAdmin?.email ?? null,
      userCnt: Number(userCount?.userCnt ?? 0),
      ...metrics,
      llmModel: this.toDepartmentLlmModels(activeApiKeys),
      mustFiltering: department.mustFiltering,
      policies: policies.map((policy) => ({
        policyId: Number(policy.policyId),
        maskingContent: policy.maskingContent,
        maskingClass: policy.maskingClass,
        isActive: true,
      })),
    });
  }

  async registerApiKey(
    departmentId: number,
    dto: AdminReqDTO.RegisterApiKey,
    authentication: Readonly<AuthenticatedUser>,
  ): Promise<AdminResDTO.RegisterApiKey> {
    const department = await this.findTotalAdminDepartment(
      departmentId,
      authentication,
    );
    const targetDepartmentId = department.departmentId;

    const service = this.toLlmService(dto.service);
    const { provider, llmNamePrefix } = getLlmServiceDescriptor(service);
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

    return this.dataSource.transaction(async (manager) => {
      const departmentRepository = manager.getRepository(DepartmentDAO);
      const activeApiKeyRepository = manager.getRepository(ActiveApiKeyDAO);
      const activeLlmRepository = manager.getRepository(ActiveLlmDAO);
      const llmDetailModelRepository = manager.getRepository(LlmDetailModelDAO);
      const memberRepository = manager.getRepository(MemberDAO);
      const adminLogRepository = manager.getRepository(AdminLogDAO);
      const lockedDepartment = await departmentRepository.findOne({
        select: {
          departmentId: true,
          mustFiltering: true,
        },
        where: { departmentId: targetDepartmentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (lockedDepartment === null) {
        throw new AdminException(AdminErrorStatus.DEPARTMENT_NOT_FOUND);
      }
      const existingApiKey = await activeApiKeyRepository.findOneBy({
        departmentId: targetDepartmentId,
        serviceType: provider,
      });
      const activeApiKey = existingApiKey
        ?? this.adminMapper.toActiveApiKeyDAO({
          apiKey: encryptedApiKey,
          serviceType: provider,
          limit: '0',
          usage: '0',
          departmentId: targetDepartmentId,
        });

      activeApiKey.apiKey = encryptedApiKey;
      activeApiKey.serviceType = provider;
      activeApiKey.limit = '0';
      activeApiKey.usage = '0';
      activeApiKey.departmentId = targetDepartmentId;
      const savedApiKey = await activeApiKeyRepository.save(activeApiKey);

      const llmDetailModels = await llmDetailModelRepository.find({
        select: { llmDetailModelId: true },
        where: {
          llmName: Raw(
            (columnAlias) => `LOWER(${columnAlias}) LIKE :llmNamePrefix`,
            { llmNamePrefix: `${llmNamePrefix}%` },
          ),
        },
      });
      if (llmDetailModels.length > 0) {
        await activeLlmRepository.upsert(
          llmDetailModels.map((llmDetailModel) => ({
            activeApiKeyId: savedApiKey.activeApiKeyId,
            llmDetailModelId: llmDetailModel.llmDetailModelId,
          })),
          ['activeApiKeyId', 'llmDetailModelId'],
        );
      }

      lockedDepartment.mustFiltering = true;
      await departmentRepository.save(lockedDepartment);

      const administrator = await memberRepository.findOneBy({
        memberId: String(authentication.userId),
      });
      if (administrator === null) {
        throw new AuthException(AuthErrorStatus.USER_NOT_FOUND);
      }
      await adminLogRepository.save({
        logContent: `${department.departmentName} 부서에 ${service} API 키를 추가했습니다.`,
        actionAt: new Date(),
        actionMemberName: administrator.memberName,
      });

      return AdminMapper.toRegisterApiKey({
        targetDepartment: department.departmentName,
        service,
        createdAt: new Date(),
      });
    });
  }

  async syncPolicies(
    departmentId: number,
    dto: AdminReqDTO.SyncPolicies,
    authentication: Readonly<AuthenticatedUser>,
  ): Promise<AdminResDTO.SyncPolicies> {
    const department = await this.findTotalAdminDepartment(
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

      const policyRepository = manager.getRepository(PolicyDAO);
      const departmentPolicyRepository =
        manager.getRepository(DepartmentPolicyDAO);
      const memberRepository = manager.getRepository(MemberDAO);
      const adminLogRepository = manager.getRepository(AdminLogDAO);
      const policies = await this.findMasterPolicies(
        policyRepository,
        requestedPolicies,
      );

      await departmentPolicyRepository.delete({
        departmentId: lockedDepartment.departmentId,
      });

      if (policies.length > 0) {
        await departmentPolicyRepository.insert(
          policies.map((policy) => ({
            departmentId: lockedDepartment.departmentId,
            policyId: policy.policyId,
            isActive: true,
          })),
        );
      }

      const administrator = await memberRepository.findOneBy({
        memberId: String(authentication.userId),
      });
      if (administrator === null) {
        throw new AuthException(AuthErrorStatus.USER_NOT_FOUND);
      }
      await adminLogRepository.save({
        logContent: `${department.departmentName} 부서의 보안 정책을 수정했습니다.`,
        actionAt: new Date(),
        actionMemberName: administrator.memberName,
      });

      return AdminMapper.toSyncPolicies(
        department.departmentName,
        policies,
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
      where: {
        departmentPolicies: {
          departmentId: department.departmentId,
          isActive: true,
        },
      },
      order: { policyId: 'ASC' },
    });
    return AdminMapper.toPolicyList(department.departmentName, policies);
  }

  async getDashboard(): Promise<AdminResDTO.Dashboard> {
    const updatedAt = new Date();
    const recentSince = new Date(updatedAt);
    recentSince.setDate(recentSince.getDate() - 30);
    const previousSince = new Date(recentSince);
    previousSince.setDate(previousSince.getDate() - 30);

    const [userCnt, userRate, dashboard] = await Promise.all([
      this.memberRepository.count(),
      this.memberRepository.count({
        where: { createdAt: MoreThanOrEqual(recentSince) },
      }),
      this.dataSource
        .getRepository(PromptLogDAO)
        .createQueryBuilder('promptLog')
        .leftJoin(
          MaskingDetailDAO,
          'maskingDetail',
          'maskingDetail.maskingReportId = promptLog.maskingReportId',
        )
        .select('COUNT(DISTINCT promptLog.promptLogId)', 'chatCnt')
        .addSelect(
          'COUNT(DISTINCT CASE WHEN promptLog.communicatedAt >= :recentSince THEN promptLog.promptLogId END)',
          'chatRate',
        )
        .addSelect(
          'COUNT(DISTINCT CASE WHEN maskingDetail.maskingDetailId IS NOT NULL THEN promptLog.promptLogId END)',
          'filterDetect',
        )
        .addSelect(
          'COUNT(DISTINCT CASE WHEN promptLog.communicatedAt >= :recentSince AND maskingDetail.maskingDetailId IS NOT NULL THEN promptLog.promptLogId END)',
          'filterDetectRate',
        )
        .addSelect(
          "COUNT(DISTINCT CASE WHEN maskingDetail.maskingDetailId IS NOT NULL AND LOWER(promptLog.modelType) LIKE 'gpt%' THEN promptLog.promptLogId END)",
          'maskingToGpt',
        )
        .addSelect(
          "COUNT(DISTINCT CASE WHEN maskingDetail.maskingDetailId IS NOT NULL AND LOWER(promptLog.modelType) LIKE 'claude%' THEN promptLog.promptLogId END)",
          'maskingToClaude',
        )
        .addSelect(
          "COUNT(DISTINCT CASE WHEN maskingDetail.maskingDetailId IS NOT NULL AND LOWER(promptLog.modelType) LIKE 'gemini%' THEN promptLog.promptLogId END)",
          'maskingToGemini',
        )
        .addSelect(
          "COUNT(DISTINCT CASE WHEN maskingDetail.maskingDetailId IS NULL AND LOWER(promptLog.modelType) LIKE 'gpt%' THEN promptLog.promptLogId END)",
          'totalGpt',
        )
        .addSelect(
          "COUNT(DISTINCT CASE WHEN maskingDetail.maskingDetailId IS NULL AND LOWER(promptLog.modelType) LIKE 'claude%' THEN promptLog.promptLogId END)",
          'totalClaude',
        )
        .addSelect(
          "COUNT(DISTINCT CASE WHEN maskingDetail.maskingDetailId IS NULL AND LOWER(promptLog.modelType) LIKE 'gemini%' THEN promptLog.promptLogId END)",
          'totalGemini',
        )
        .addSelect(
          "COUNT(DISTINCT CASE WHEN LOWER(promptLog.modelType) LIKE 'local%' THEN promptLog.promptLogId END)",
          'local',
        )
        .addSelect(
          "COUNT(DISTINCT CASE WHEN promptLog.communicatedAt >= :recentSince AND LOWER(promptLog.modelType) LIKE 'local%' THEN promptLog.promptLogId END)",
          'currentLocalCnt',
        )
        .addSelect(
          'COUNT(DISTINCT CASE WHEN promptLog.communicatedAt >= :recentSince THEN promptLog.promptLogId END)',
          'currentTotalCnt',
        )
        .addSelect(
          "COUNT(DISTINCT CASE WHEN promptLog.communicatedAt >= :previousSince AND promptLog.communicatedAt < :recentSince AND LOWER(promptLog.modelType) LIKE 'local%' THEN promptLog.promptLogId END)",
          'previousLocalCnt',
        )
        .addSelect(
          'COUNT(DISTINCT CASE WHEN promptLog.communicatedAt >= :previousSince AND promptLog.communicatedAt < :recentSince THEN promptLog.promptLogId END)',
          'previousTotalCnt',
        )
        .setParameters({ recentSince, previousSince })
        .getRawOne<DashboardRaw>(),
    ]);

    const currentLocalRate = this.toRatioPercent(
      Number(dashboard?.currentLocalCnt ?? 0),
      Number(dashboard?.currentTotalCnt ?? 0),
    );
    const previousLocalRate = this.toRatioPercent(
      Number(dashboard?.previousLocalCnt ?? 0),
      Number(dashboard?.previousTotalCnt ?? 0),
    );

    return AdminMapper.toDashboard({
      updatedAt: updatedAt.toISOString(),
      userCnt,
      userRate,
      chatCnt: Number(dashboard?.chatCnt ?? 0),
      chatRate: Number(dashboard?.chatRate ?? 0),
      filterDetect: Number(dashboard?.filterDetect ?? 0),
      filterDetectRate: Number(dashboard?.filterDetectRate ?? 0),
      maskingToGpt: Number(dashboard?.maskingToGpt ?? 0),
      maskingToClaude: Number(dashboard?.maskingToClaude ?? 0),
      maskingToGemini: Number(dashboard?.maskingToGemini ?? 0),
      totalGpt: Number(dashboard?.totalGpt ?? 0),
      totalClaude: Number(dashboard?.totalClaude ?? 0),
      totalGemini: Number(dashboard?.totalGemini ?? 0),
      local: Number(dashboard?.local ?? 0),
      localRate: this.roundToOneDecimal(currentLocalRate - previousLocalRate),
    });
  }

  async getTrends(dto: AdminReqDTO.Trends): Promise<AdminResDTO.Trends> {
    void dto;
    return AdminMapper.toUnknown(null);
  }

  async getAdminLogs(): Promise<AdminResDTO.AdminLogs> {
    const logs = await this.adminLogRepository.find({
      select: {
        adminLogId: true,
        logContent: true,
        actionAt: true,
        actionMemberName: true,
      },
      order: { actionAt: 'DESC', adminLogId: 'DESC' },
    });
    if (logs.length === 0) {
      return null;
    }
    return logs.map((log) => AdminMapper.toAdminLog(
      log.logContent,
      this.toDateTimeString(log.actionAt),
      log.actionMemberName,
    ));
  }
  async getPolicyDetect(): Promise<AdminResDTO.PolicyDetectList> {
    const rows = await this.policyRepository
      .createQueryBuilder('policy')
      .leftJoin(
        MaskingDetailDAO,
        'maskingDetail',
        'maskingDetail.policyId = policy.policyId',
      )
      .leftJoin(
        PromptLogDAO,
        'promptLog',
        'promptLog.maskingReportId = maskingDetail.maskingReportId',
      )
      .select('policy.maskingClass', 'category')
      .addSelect('policy.maskingContent', 'detailCategory')
      .addSelect('COUNT(DISTINCT promptLog.promptLogId)', 'count')
      .groupBy('policy.policyId')
      .addGroupBy('policy.maskingClass')
      .addGroupBy('policy.maskingContent')
      .orderBy('policy.maskingClass', 'ASC')
      .addOrderBy('policy.maskingContent', 'ASC')
      .getRawMany<PolicyDetectRaw>();

    return rows.map((row) => AdminMapper.toPolicyDetect(
      row.category,
      row.detailCategory,
      Number(row.count),
    ));
  }

  async getDepartmentRisks(
    dto: AdminReqDTO.DepartmentRisks,
  ): Promise<AdminResDTO.DepartmentRiskList> {
    const since = this.toDepartmentRiskSince(dto.recent, new Date());
    const rows = await this.departmentRepository
      .createQueryBuilder('department')
      .leftJoin(
        MemberDepartmentDAO,
        'membership',
        'membership.departmentId = department.departmentId',
      )
      .leftJoin(
        PromptRoomDAO,
        'promptRoom',
        'promptRoom.memberId = membership.memberId',
      )
      .leftJoin(
        PromptLogDAO,
        'promptLog',
        'promptLog.promptRoomId = promptRoom.promptRoomId AND promptLog.communicatedAt >= :since',
      )
      .leftJoin(
        MaskingDetailDAO,
        'maskingDetail',
        'maskingDetail.maskingReportId = promptLog.maskingReportId',
      )
      .select('department.departmentName', 'departmentName')
      .addSelect('COUNT(DISTINCT membership.memberId)', 'userCnt')
      .addSelect('COUNT(DISTINCT promptLog.promptLogId)', 'llmRequestCnt')
      .addSelect(
        'COUNT(DISTINCT CASE WHEN maskingDetail.maskingDetailId IS NOT NULL THEN promptLog.promptLogId END)',
        'detectCnt',
      )
      .groupBy('department.departmentId')
      .addGroupBy('department.departmentName')
      .orderBy('department.departmentName', 'ASC')
      .addOrderBy('department.departmentId', 'ASC')
      .setParameter('since', since)
      .getRawMany<DepartmentRiskRaw>();

    return rows.map((row) => AdminMapper.toDepartmentRisk(
      row.departmentName,
      Number(row.llmRequestCnt),
      Number(row.userCnt),
      this.toRatioPercent(Number(row.detectCnt), Number(row.llmRequestCnt)),
    ));
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
      .leftJoin(
        MemberDepartmentDAO,
        'membership',
        'membership.memberId = member.memberId',
      )
      .leftJoin(
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
      .addSelect('member.authorize', 'authorize')
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
        authorize: this.toRoleName(row.authorize),
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

    await this.recordAdminActivity(
      authentication.userId,
      `${member.memberName} 사용자 계정을 비활성화했습니다.`,
    );

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
      await this.recordAdminActivity(
        authentication.userId,
        `${member.memberName} 사용자 계정을 복구했습니다.`,
      );
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
    if (
      departmentName.length === 0
      || departmentName.length > MAX_DEPARTMENT_NAME_LENGTH
    ) {
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

  private toLlmService(service: unknown): LlmService {
    const normalizedService = normalizeLlmService(service);
    if (normalizedService === null) {
      throw new AdminException(AdminErrorStatus.INVALID_API_KEY);
    }

    return normalizedService;
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

  private async findTotalAdminDepartment(
    departmentId: number,
    authentication: Readonly<AuthenticatedUser>,
  ): Promise<DepartmentDAO> {
    if (authentication.role !== UserRole.TOTAL_ADMIN) {
      throw new SecurityException(SecurityErrorStatus.FORBIDDEN);
    }
    if (!Number.isSafeInteger(departmentId) || departmentId <= 0) {
      throw new AdminException(AdminErrorStatus.DEPARTMENT_NOT_FOUND);
    }

    const department = await this.departmentRepository.findOneBy({
      departmentId: String(departmentId),
    });
    if (department === null) {
      throw new AdminException(AdminErrorStatus.DEPARTMENT_NOT_FOUND);
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

  private toMaskingContent(value: unknown): SecurityPolicyContent {
    if (typeof value !== 'string') {
      throw new AdminException(AdminErrorStatus.INVALID_POLICY);
    }
    const normalized = value.trim().toUpperCase();
    if (!SECURITY_POLICY_CONTENTS.includes(normalized as SecurityPolicyContent)) {
      throw new AdminException(AdminErrorStatus.INVALID_POLICY);
    }
    return normalized as SecurityPolicyContent;
  }

  private getMaskingClass(
    maskingContent: SecurityPolicyContent,
  ): MaskingClass {
    return getDefaultPolicy(maskingContent).maskingClass === 'SENSITIVE'
      ? MaskingClass.SENSITIVE
      : MaskingClass.PRIVATE;
  }

  private normalizePolicyList(policies: unknown): SecurityPolicyContent[] {
    if (
      !Array.isArray(policies)
      || policies.length > SECURITY_POLICY_CONTENTS.length
    ) {
      throw new AdminException(AdminErrorStatus.INVALID_POLICY);
    }

    const normalized = policies.map((policy) => this.toMaskingContent(policy));
    if (new Set(normalized).size !== normalized.length) {
      throw new AdminException(AdminErrorStatus.DUPLICATE_POLICY);
    }
    return normalized;
  }

  private async findMasterPolicies(
    policyRepository: Repository<PolicyDAO>,
    requestedPolicies: readonly SecurityPolicyContent[],
  ): Promise<PolicyDAO[]> {
    if (requestedPolicies.length === 0) {
      return [];
    }

    const policies = await policyRepository.find({
      where: requestedPolicies.map((maskingContent) => ({
        maskingContent,
        maskingClass: this.getMaskingClass(maskingContent),
      })),
      order: { policyId: 'ASC' },
    });
    const policyByContent = new Map<SecurityPolicyContent, PolicyDAO>();
    for (const policy of policies) {
      const maskingContent = this.toMaskingContent(policy.maskingContent);
      if (!policyByContent.has(maskingContent)) {
        policyByContent.set(maskingContent, policy);
      }
    }

    const result: PolicyDAO[] = [];
    for (const maskingContent of requestedPolicies) {
      const policy = policyByContent.get(maskingContent);
      if (policy === undefined) {
        throw new AdminException(AdminErrorStatus.POLICY_NOT_FOUND);
      }
      result.push(policy);
    }
    return result;
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

  private normalizeDepartmentListQuery(
    dto: AdminReqDTO.DepartmentList,
  ): DepartmentListQuery {
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

    if (dto.query === undefined) {
      return { pageSize, pageNumber };
    }
    if (typeof dto.query !== 'string') {
      throw new AdminException(
        AdminErrorStatus.INVALID_DEPARTMENT_LIST_QUERY,
      );
    }

    const query = dto.query.trim();
    if (query.length === 0 || query.length > MAX_DEPARTMENT_NAME_LENGTH) {
      throw new AdminException(
        AdminErrorStatus.INVALID_DEPARTMENT_LIST_QUERY,
      );
    }

    return { pageSize, pageNumber, query };
  }

  private toDepartmentRiskSince(recent: string, now: Date): Date {
    const daysByRecent: Record<string, number> = {
      '7일': 7,
      '1달': 30,
      '3달': 90,
    };
    const days = daysByRecent[recent];
    if (days === undefined) {
      throw new AdminException(AdminErrorStatus.INVALID_DEPARTMENT_LIST_QUERY);
    }
    const since = new Date(now);
    since.setDate(since.getDate() - days);
    return since;
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

  private async recordAdminActivity(
    administratorId: number,
    logContent: string,
  ): Promise<void> {
    const administrator = await this.memberRepository.findOneBy({
      memberId: String(administratorId),
    });
    if (administrator === null) {
      throw new AuthException(AuthErrorStatus.USER_NOT_FOUND);
    }
    await this.adminLogRepository.save({
      logContent,
      actionAt: new Date(),
      actionMemberName: administrator.memberName,
    });
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
