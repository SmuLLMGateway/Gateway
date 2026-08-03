import { HttpStatus, Injectable, Optional } from '@nestjs/common';
import {
  DataSource,
  In,
  IsNull,
  LessThanOrEqual,
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
import { MemberLimitDAO } from '../../user/dao/member-limit.dao.js';
import { UserMapper } from '../../user/mapper/user.mapper.js';
import { PasswordEncoderService } from '../../../global/security/service/password-encoder.service.js';
import { UserRole } from '../../../global/security/type/user-role.enum.js';
import type { AuthenticatedUser } from '../../../global/security/type/jwt-payload.type.js';
import { SecurityException } from '../../../global/security/exception/security.exception.js';
import { SecurityErrorStatus } from '../../../global/security/code/security.status.js';
import { AuthException } from '../../auth/exception/auth.exception.js';
import { AuthErrorStatus } from '../../auth/code/auth.status.js';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type EntityManager } from 'typeorm';
import { ActiveApiKeyDAO } from '../dao/active-api-key.dao.js';
import { ActiveLlmDAO } from '../dao/active-llm.dao.js';
import { LlmDetailModelDAO } from '../dao/llm-detail-model.dao.js';
import { LlmApiKeyValidationClient } from '../../../global/llm/client/llm-api-key-validation.client.js';
import { LlmApiKeyValidationResult } from '../../../global/llm/enum/llm-api-key-validation-result.enum.js';
import { LlmService } from '../../../global/llm/enum/llm-service.enum.js';
import {
  getLlmServiceDescriptor,
  LOCAL_LLM_MODEL,
  LOCAL_LLM_MODEL_PREFIX,
  normalizeLlmService,
  toLocalLlmModelName,
} from '../../../global/llm/llm-service.mapping.js';
import { ApiKeyEncryptionService } from '../../../global/llm/service/api-key-encryption.service.js';
import { MaskingClass, PolicyDAO } from '../dao/policy.dao.js';
import { DepartmentPolicyDAO } from '../dao/department-policy.dao.js';
import {
  getDefaultPolicy,
  getSecurityPolicyClassDisplayName,
  getSecurityPolicyDisplayName,
  SECURITY_POLICY_CONTENTS,
  type SecurityPolicyContent,
} from '../policy/security-policy.catalog.js';
import { PromptRoomDAO } from '../../prompt/dao/prompt-room.dao.js';
import { PromptLogDAO } from '../../prompt/dao/prompt-log.dao.js';
import { MaskingDetailDAO } from '../../prompt/dao/masking-detail.dao.js';
import { PromptException } from '../../prompt/exception/prompt.exception.js';
import { PromptErrorStatus } from '../../prompt/code/prompt.status.js';
import { AdminLogDAO } from '../dao/admin-log.dao.js';
import { PromptLogStatus } from '../../prompt/type/prompt-log-status.enum.js';
import { PresetDAO } from '../dao/preset.dao.js';
import { PresetPolicyDAO } from '../dao/preset-policy.dao.js';
import {
  HealthHistoryDAO,
  HealthServiceName,
  HealthStatus,
} from '../dao/health-history.dao.js';
import { MinioObjectStorageService } from '../../../global/storage/service/minio-object-storage.service.js';
import { NerConfig } from '../../../global/ner/config/ner.config.js';
import { NerClient } from '../../../global/ner/client/ner.client.js';
import { NerRequestException } from '../../../global/ner/exception/ner-request.exception.js';
import type {
  NerDeploymentDetail,
  NerDeploymentSummary,
} from '../../../global/ner/type/ner-deployment-summary.type.js';
import type { NerLlmDeploymentDetail } from '../../../global/ner/type/ner-llm-deployment.type.js';
import {
  LLM_ADAPTER_TYPES,
  NER_ADAPTER_TYPES,
  type LlmAdapterType,
  type LlmDeploymentCreateRequest,
  type NerAdapterType,
  type NerDeploymentCreateRequest,
} from '../../../global/ner/type/ner-deployment-registration.type.js';
import { ProviderConfig } from '../../../global/llm/config/provider.config.js';
import {
  toKoreaStandardTimeDateString,
  toKoreaStandardTimeISOString,
} from '../../../global/time/korea-standard-time.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_PROFILE_URL = '';
const USER_LIST_ORDER = {
  RECENT: 'recent',
  DEPARTMENT: 'department',
  ROLE: 'role',
  STATUS: 'status',
} as const;
const MAX_USER_LIST_PAGE_SIZE = 100;
const INITIAL_PAGE_NUMBER = 1;
const MAX_DEPARTMENT_LIST_PAGE_SIZE = 100;
const MAX_DEPARTMENT_NAME_LENGTH = 255;
const MAX_DEPARTMENT_CODE_LENGTH = 10;
const MAX_LOCAL_DEPLOYMENT_TEXT_LENGTH = 255;
const MAX_LOCAL_DEPLOYMENT_URL_LENGTH = 2_048;
const MAX_LOCAL_DEPLOYMENT_TIMEOUT_MS = 3_600_000;
const MAX_LLM_DETAIL_MODEL_NAME_LENGTH = 50;

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

interface HealthCheckResult {
  readonly status: HealthStatus;
  readonly latency: number;
}

interface UserListRaw {
  readonly userId: string;
  readonly name: string;
  readonly email: string;
  readonly department: string | null;
  readonly authorize: UserRole;
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
  readonly department: string | null;
  readonly role: UserRole;
  readonly createdAt: Date | string;
  readonly createdBy: string;
  readonly chatCnt: string;
  readonly filterDetectCnt: string;
  readonly masking: string;
  readonly local: string;
}

interface UserPromptOverviewRaw {
  readonly userId: string;
  readonly name: string;
  readonly department: string;
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

interface LogsSummaryRaw {
  readonly totalChatCnt: string;
  readonly filterDetectCnt: string;
  readonly masking: string;
  readonly local: string;
}

type SystemHealthValue = AdminResDTO.SystemHealth['totalSystemHealth'];

const SYSTEM_HEALTH_STATUS_BY_HISTORY: Readonly<Record<HealthStatus, SystemHealthValue>> = {
  [HealthStatus.OK]: '정상',
  [HealthStatus.DELAY]: '지연',
  [HealthStatus.ERROR]: '오류',
  [HealthStatus.CHECK]: '점검',
};

const SYSTEM_HEALTH_PRIORITY: Readonly<Record<SystemHealthValue, number>> = {
  정상: 0,
  지연: 1,
  점검: 2,
  오류: 3,
};

const OUTBOUND_LLM_SERVICES = [
  HealthServiceName.GPT,
  HealthServiceName.GEMINI,
  HealthServiceName.CLAUDE,
] as const;
const MODEL_HEALTH_SERVICES = [
  ...OUTBOUND_LLM_SERVICES,
  HealthServiceName.LOCAL_LLM,
] as const;
const MODEL_HEALTH_HISTORY_LIMIT = 25;
const DELAY_LATENCY_MS = 1_000;
const MODEL_HISTORY_STATUS_VALUE: Readonly<Record<HealthStatus, number>> = {
  [HealthStatus.OK]: 0,
  [HealthStatus.DELAY]: 1,
  [HealthStatus.ERROR]: 2,
  [HealthStatus.CHECK]: 3,
};

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
    @InjectRepository(MemberLimitDAO)
    private readonly memberLimitRepository: Repository<MemberLimitDAO>,
    @InjectRepository(ActiveApiKeyDAO)
    private readonly activeApiKeyRepository: Repository<ActiveApiKeyDAO>,
    @InjectRepository(DepartmentPolicyDAO)
    private readonly departmentPolicyRepository: Repository<DepartmentPolicyDAO>,
    @InjectRepository(PolicyDAO)
    private readonly policyRepository: Repository<PolicyDAO>,
    @InjectRepository(AdminLogDAO)
    private readonly adminLogRepository: Repository<AdminLogDAO>,
    @InjectRepository(HealthHistoryDAO)
    private readonly healthHistoryRepository: Repository<HealthHistoryDAO>,
    private readonly apiKeyValidationClient: LlmApiKeyValidationClient,
    private readonly apiKeyEncryption: ApiKeyEncryptionService,
    private readonly objectStorage: MinioObjectStorageService,
    private readonly nerConfig?: NerConfig,
    private readonly providerConfig?: ProviderConfig,
    @Optional()
    private readonly nerClient?: NerClient,
  ) {}

  async createUser(
    dto: AdminReqDTO.CreateUser,
    authentication: AuthenticatedUser,
  ): Promise<AdminResDTO.CreateUser> {
    return this.dataSource.transaction(async (manager) => {
      const memberRepository = manager.getRepository(MemberDAO);
      const memberDepartmentRepository = manager.getRepository(MemberDepartmentDAO);
      const adminLogRepository = manager.getRepository(AdminLogDAO);

      if (!this.isValidEmail(dto.email)) {
        throw new AdminException(AdminErrorStatus.INVALID_EMAIL);
      }

      const authorize = this.toUserRole(dto.authorize);

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

      const managedDepartment = creator.authorize === UserRole.DEPART_ADMIN
        ? await memberDepartmentRepository.findOneBy({
          memberId: creator.memberId,
        })
        : null;

      if (creator.authorize === UserRole.DEPART_ADMIN && managedDepartment === null) {
        throw new AdminException(AdminErrorStatus.NOT_MANAGED_DEPARTMENT);
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
        if (managedDepartment !== null) {
          const memberDepartment = this.userMapper.toMemberDepartmentDAO({
            memberId: savedMember.memberId,
            departmentId: managedDepartment.departmentId,
          });
          await memberDepartmentRepository.save(memberDepartment);
        }

        await adminLogRepository.save({
          logContent: `${savedMember.memberName} 사용자 계정을 생성했습니다.`,
          actionAt: new Date(),
          actionMemberName: creator.memberName,
        });

        return AdminMapper.toCreateUser({
          id: savedMember.memberId,
          name: savedMember.memberName,
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
    const departmentCode = this.normalizeDepartmentCode(dto.code);
    const departmentAdminId = this.normalizeDepartmentAdminId(
      dto.departmentAdminId,
    );
    // 로컬 LLM은 항상 활성화하지만, 명세상 전달되는 Boolean 값의 형식은 검증합니다.
    this.normalizeDepartmentBoolean(dto.activeLocalLLM);
    const mustFiltering = this.normalizeDepartmentBoolean(dto.mustFiltering);
    const departmentLimit = this.normalizeDepartmentLimit(dto.departmentLimit);

    return this.dataSource.transaction(async (manager) => {
      const departmentRepository = manager.getRepository(DepartmentDAO);
      const memberRepository = manager.getRepository(MemberDAO);
      const memberDepartmentRepository = manager.getRepository(MemberDepartmentDAO);
      const activeApiKeyRepository = manager.getRepository(ActiveApiKeyDAO);
      const existingDepartment = await departmentRepository.findOne({
        select: { departmentId: true },
        where: { departmentName },
      });

      if (existingDepartment !== null) {
        throw new AdminException(AdminErrorStatus.DUPLICATE_DEPARTMENT);
      }

      const departmentAdmin = await memberRepository.findOne({
        select: { memberId: true, authorize: true },
        where: {
          memberId: String(departmentAdminId),
          disabledAt: IsNull(),
        },
        // 하나의 부서 관리자가 동시에 여러 부서에 연결되는 것을 방지합니다.
        lock: { mode: 'pessimistic_write' },
      });
      if (departmentAdmin === null) {
        throw new AuthException(AuthErrorStatus.USER_NOT_FOUND);
      }
      if (departmentAdmin.authorize !== UserRole.DEPART_ADMIN) {
        throw new AdminException(AdminErrorStatus.INVALID_DEPARTMENT_ADMIN);
      }

      const existingMembership = await memberDepartmentRepository.findOneBy({
        memberId: departmentAdmin.memberId,
      });
      if (existingMembership !== null) {
        throw new AdminException(AdminErrorStatus.INVALID_DEPARTMENT_ADMIN);
      }

      // llm_detail_model에는 비활성화된 모델도 카탈로그로 남아 있으므로, 새 부서는
      // LPL에서 실제로 enabled인 local-* 모델만 연결합니다.
      const enabledLocalLlmModelNames = await this.getEnabledLocalLlmModelNames();

      const department = this.adminMapper.toDepartmentDAO({
        departmentName,
        departmentCode,
        mustFiltering,
        limit: departmentLimit,
      });

      try {
        const savedDepartment = await departmentRepository.save(department);
        const localLlmActiveApiKey = await activeApiKeyRepository.save(
          this.adminMapper.toLocalLlmActiveApiKeyDAO(
            savedDepartment.departmentId,
          ),
        );
        await this.linkLocalLlmModelsToActiveApiKey(
          manager,
          localLlmActiveApiKey.activeApiKeyId,
          enabledLocalLlmModelNames,
        );
        await memberDepartmentRepository.save({
          memberId: departmentAdmin.memberId,
          departmentId: savedDepartment.departmentId,
        });

        return AdminMapper.toCreateDepartment({
          departmentId: savedDepartment.departmentId,
          departmentName: savedDepartment.departmentName,
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

  /**
   * 미소속 활성 사용자만 대상 부서에 연동합니다.
   * 요청에 포함됐더라도 존재하지 않거나 비활성화됐거나 이미 다른 부서에
   * 연동된 사용자는 결과에서 제외합니다.
   */
  async linkDepartmentUsers(
    departmentId: number,
    dto: AdminReqDTO.LinkDepartmentUsers,
    authentication: Readonly<AuthenticatedUser>,
  ): Promise<AdminResDTO.LinkDepartmentUsers> {
    const userIds = this.normalizeLinkDepartmentUserIds(dto.userIds);

    return this.dataSource.transaction(async (manager) => {
      const departmentRepository = manager.getRepository(DepartmentDAO);
      const memberRepository = manager.getRepository(MemberDAO);
      const memberDepartmentRepository = manager.getRepository(MemberDepartmentDAO);
      const memberLimitRepository = manager.getRepository(MemberLimitDAO);
      const activeApiKeyRepository = manager.getRepository(ActiveApiKeyDAO);
      const adminLogRepository = manager.getRepository(AdminLogDAO);

      const department = await departmentRepository.findOne({
        select: { departmentId: true, departmentName: true, limit: true },
        where: { departmentId: String(departmentId) },
        // 같은 부서에 대한 동시 연동 요청은 사용자 수와 개인 한도 재배분을
        // 하나의 순서로 처리해야 하므로 부서 행을 잠급니다.
        lock: { mode: 'pessimistic_write' },
      });

      if (department === null) {
        throw new AdminException(AdminErrorStatus.DEPARTMENT_NOT_FOUND);
      }

      const requestedMemberIds = userIds.map(String);
      const [activeUsers, memberships] = await Promise.all([
        memberRepository.find({
          select: { memberId: true, memberName: true },
          where: {
            memberId: In(requestedMemberIds),
            disabledAt: IsNull(),
          },
        }),
        memberDepartmentRepository.find({
          select: { memberId: true },
          where: { memberId: In(requestedMemberIds) },
        }),
      ]);

      const assignedMemberIds = new Set(
        memberships.map((membership) => membership.memberId),
      );
      const activeUserById = new Map(
        activeUsers.map((user) => [user.memberId, user]),
      );
      const usersToLink = requestedMemberIds
        .map((memberId) => activeUserById.get(memberId))
        .filter((user): user is MemberDAO =>
          user !== undefined && !assignedMemberIds.has(user.memberId),
        );

      if (usersToLink.length === 0) {
        throw new AdminException(AdminErrorStatus.NO_LINKABLE_USERS);
      }

      await memberDepartmentRepository.save(
        usersToLink.map((user) => ({
          memberId: user.memberId,
          departmentId: department.departmentId,
        })),
      );

      const [allMemberships, activeApiKeys] = await Promise.all([
        memberDepartmentRepository.find({
          select: { memberId: true },
          where: { departmentId: department.departmentId },
        }),
        activeApiKeyRepository.find({
          select: { activeApiKeyId: true },
          where: {
            departmentId: department.departmentId,
            serviceType: Not(LOCAL_LLM_MODEL),
          },
        }),
      ]);
      const memberIds = [...new Set(allMemberships.map(({ memberId }) => memberId))];

      if (activeApiKeys.length > 0) {
        const personalLimit = this.divideDepartmentLimit(
          department.limit,
          memberIds.length,
        );
        await memberLimitRepository.upsert(
          memberIds.flatMap((memberId) =>
            activeApiKeys.map((activeApiKey) => ({
              memberId,
              activeApiKeyId: activeApiKey.activeApiKeyId,
              limit: personalLimit,
            })),
          ),
          ['memberId', 'activeApiKeyId'],
        );
      }

      const administrator = await memberRepository.findOneBy({
        memberId: String(authentication.userId),
      });
      if (administrator === null) {
        throw new AuthException(AuthErrorStatus.USER_NOT_FOUND);
      }
      await adminLogRepository.save({
        logContent:
          `${department.departmentName} 부서에 사용자 ${usersToLink.length}명을 연동했습니다.`,
        actionAt: new Date(),
        actionMemberName: administrator.memberName,
      });

      return {
        departmentId: Number(department.departmentId),
        departmentName: department.departmentName,
        users: usersToLink.map((user) => ({
          userId: Number(user.memberId),
          userName: user.memberName,
        })),
      };
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
          limit: true,
          usage: true,
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
      const quota = this.toDepartmentQuota(department);

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
   * v3에서는 부서 공통 한도와 사용량을 department에 저장합니다.
   */
  private toDepartmentQuota(
    department: Pick<
      DepartmentDAO,
      'limit' | 'usage'
    >,
  ): DepartmentQuota {
    const limit = Number(department.limit);
    const usage = Number(department.usage);
    const isUnlimited = limit === 0;
    return {
      departLimitPercent: isUnlimited
        ? 100
        : Math.round((usage * 100) / limit),
      departLimitUsd: isUnlimited ? 0 : limit,
      departUseUsd: usage,
    };
  }

  private toDepartmentDetailUsageMetrics(
    department: Pick<
      DepartmentDAO,
      'limit' | 'usage'
    >,
  ): DepartmentDetailUsageMetrics {
    const limit = Number(department.limit);
    const usage = Number(department.usage);
    const isUnlimited = limit === 0;

    return {
      usePercent: isUnlimited
        ? 100
        : Math.round((usage * 100) / limit),
      useUsd: usage,
      limitUsd: isUnlimited ? 0 : limit,
      remainUsd: isUnlimited || usage >= limit ? 0 : limit - usage,
    };
  }

  private toDepartmentLlmModels(
    activeApiKeys: readonly ActiveApiKeyDAO[],
  ): AdminResDTO.DepartmentLlmModel[] {
    const services = this.toAvailableLlmServices(activeApiKeys) ?? [];

    return [
      { modelName: LOCAL_LLM_MODEL, hasApiKey: true },
      ...services
        .filter((service) => service !== LOCAL_LLM_MODEL)
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
  ): string[] {
    const serviceTypes = new Set(
      activeApiKeys.map((activeApiKey) => activeApiKey.serviceType),
    );
    const canonicalServices = Object.values(LlmService).filter((service) =>
      serviceTypes.has(service),
    );
    const additionalServices = [...serviceTypes]
      .filter((service) => !canonicalServices.includes(service as LlmService))
      .sort((left, right) => left.localeCompare(right));

    return [
      LOCAL_LLM_MODEL,
      ...canonicalServices,
      ...additionalServices.filter((service) => service !== LOCAL_LLM_MODEL),
    ];
  }

  async getDepartmentManagementSummary(): Promise<
    AdminResDTO.DepartmentManagementSummary
  > {
    const [departments, totalUserCnt] = await Promise.all([
      this.departmentRepository.find({
        select: {
          departmentId: true,
          mustFiltering: true,
          limit: true,
          usage: true,
          recentUsePercent: true,
        },
      }),
      this.memberRepository.count(),
    ]);
    const averageUsePercent = this.toAveragePercent(
      departments.map((department) => this.toDepartmentQuota(department)
        .departLimitPercent),
    );
    const averageRecentUsePercent = this.toAveragePercent(
      departments.map((department) => Number(
        department.recentUsePercent ?? '0',
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
          },
          where: { departmentId: department.departmentId },
          order: { serviceType: 'ASC' },
        }),
        this.departmentPolicyRepository.find({
          select: {
            departmentPolicyId: true,
            isActive: true,
            policy: {
              policyId: true,
              maskingContent: true,
              maskingClass: true,
            },
          },
          relations: { policy: true },
          where: { departmentId: department.departmentId },
          order: {
            policy: { policyId: 'ASC' },
            departmentPolicyId: 'ASC',
          },
        }),
      ]);
    const metrics = this.toDepartmentDetailUsageMetrics(department);

    return AdminMapper.toDepartmentDetail({
      departmentName: department.departmentName,
      departmentAdminName: departmentAdmin?.name ?? null,
      departmentAdminAuthorize: departmentAdmin === undefined
        ? null
        : this.toRoleName(departmentAdmin.authorize),
      email: departmentAdmin?.email ?? null,
      userCnt: Number(userCount?.userCnt ?? 0),
      ...metrics,
      llmModel: this.toDepartmentLlmModels(activeApiKeys),
      mustFiltering: department.mustFiltering,
      policies: policies.length === 0
        ? null
        : policies.map((departmentPolicy) => ({
          policyId: Number(departmentPolicy.policy.policyId),
          maskingContent: getSecurityPolicyDisplayName(
            departmentPolicy.policy.maskingContent,
          ),
          maskingClass: getSecurityPolicyClassDisplayName(
            departmentPolicy.policy.maskingClass,
          ),
          isActive: departmentPolicy.isActive,
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
      const memberDepartmentRepository = manager.getRepository(MemberDepartmentDAO);
      const memberLimitRepository = manager.getRepository(MemberLimitDAO);
      const memberRepository = manager.getRepository(MemberDAO);
      const adminLogRepository = manager.getRepository(AdminLogDAO);
      const lockedDepartment = await departmentRepository.findOne({
        select: {
          departmentId: true,
          mustFiltering: true,
          usage: true,
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
          departmentId: targetDepartmentId,
        });

      activeApiKey.apiKey = encryptedApiKey;
      activeApiKey.serviceType = provider;
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
      lockedDepartment.usage = '0';
      await departmentRepository.save(lockedDepartment);

      const memberships = await memberDepartmentRepository.find({
        select: { memberId: true },
        where: { departmentId: targetDepartmentId },
      });
      const memberIds = [...new Set(memberships.map((membership) => membership.memberId))];
      if (memberIds.length > 0) {
        await memberLimitRepository.update(
          { memberId: In(memberIds) },
          { usage: '0' },
        );
      }

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

  async registerLocalLlm(
    dto: Readonly<AdminReqDTO.RegisterLocalLlm>,
    authentication: Readonly<AuthenticatedUser>,
  ): Promise<AdminResDTO.RegisterLocalLlm> {
    this.assertTotalAdministrator(authentication);
    const request = this.toLocalLlmDeploymentCreateRequest(dto);
    const deployment = await this.createLlmDeployment(request);
    await this.syncEnabledLocalLlmModels();
    const createdAt = new Date();

    await this.recordAdminActivity(
      authentication.userId,
      `로컬 LLM Deployment ${deployment.deploymentId}를 등록하고 모든 부서의 사용 가능 모델을 동기화했습니다.`,
    );

    return {
      deploymentId: deployment.deploymentId,
      createdAt: toKoreaStandardTimeISOString(createdAt),
    };
  }

  async getLocalLlmList(
    authentication: Readonly<AuthenticatedUser>,
  ): Promise<AdminResDTO.LocalLlmList> {
    this.assertTotalAdministrator(authentication);

    return {
      deployments: await this.getLocalDeploymentSummaries(
        () => this.getNerClient().getLlmDeployments(),
      ),
    };
  }

  async updateLocalLlmStatus(
    deploymentId: string,
    dto: Readonly<AdminReqDTO.UpdateLocalDeploymentStatus>,
    authentication: Readonly<AuthenticatedUser>,
  ): Promise<AdminResDTO.UpdateLocalLlmStatus> {
    this.assertTotalAdministrator(authentication);
    const normalizedDeploymentId = this.normalizeLocalDeploymentText(deploymentId);
    const enabled = this.toLocalDeploymentStatusUpdateRequest(dto);
    const deployment = await this.updateLlmDeploymentEnabled(
      normalizedDeploymentId,
      enabled,
    );

    await this.synchronizeUpdatedLocalLlmAvailability(deployment);
    await this.recordAdminActivity(
      authentication.userId,
      `로컬 LLM Deployment ${deployment.deploymentId}를 ${deployment.enabled ? '활성화' : '비활성화'}했습니다.`,
    );

    return deployment;
  }

  async updateLocalNerStatus(
    deploymentId: string,
    dto: Readonly<AdminReqDTO.UpdateLocalDeploymentStatus>,
    authentication: Readonly<AuthenticatedUser>,
  ): Promise<AdminResDTO.UpdateLocalNerStatus> {
    this.assertTotalAdministrator(authentication);
    const normalizedDeploymentId = this.normalizeLocalDeploymentText(deploymentId);
    const enabled = this.toLocalDeploymentStatusUpdateRequest(dto);
    const deployment = await this.updateNerDeploymentEnabled(
      normalizedDeploymentId,
      enabled,
    );

    await this.recordAdminActivity(
      authentication.userId,
      `로컬 NER Deployment ${deployment.deploymentId}를 ${deployment.enabled ? '활성화' : '비활성화'}했습니다.`,
    );

    return deployment;
  }

  async registerLocalNer(
    dto: Readonly<AdminReqDTO.RegisterLocalNer>,
    authentication: Readonly<AuthenticatedUser>,
  ): Promise<AdminResDTO.RegisterLocalNer> {
    this.assertTotalAdministrator(authentication);
    const request = this.toLocalNerDeploymentCreateRequest(dto);
    const deployment = await this.createNerDeployment(request);
    const createdAt = new Date();

    await this.recordAdminActivity(
      authentication.userId,
      `로컬 NER Deployment ${deployment.deploymentId}를 등록했습니다.`,
    );

    return {
      deploymentId: deployment.deploymentId,
      createdAt: toKoreaStandardTimeISOString(createdAt),
    };
  }

  async getDepartmentApiKey(
    dto: Readonly<AdminReqDTO.DepartmentApiKey>,
    authentication: Readonly<AuthenticatedUser>,
  ): Promise<AdminResDTO.DepartmentApiKey> {
    const department = await this.findAdministrativeDepartment(authentication);
    const service = this.toLlmService(dto.service);
    const { provider } = getLlmServiceDescriptor(service);
    const activeApiKey = await this.activeApiKeyRepository.findOne({
      select: { apiKey: true },
      where: {
        departmentId: department.departmentId,
        serviceType: provider,
      },
    });
    if (activeApiKey === null || activeApiKey.apiKey === null) {
      throw new AdminException(AdminErrorStatus.API_KEY_NOT_FOUND);
    }

    return {
      service,
      apiKey: this.apiKeyEncryption.decrypt(
        activeApiKey.apiKey,
        department.departmentId,
        provider,
      ),
    };
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
      const presetPolicyRepository = manager.getRepository(PresetPolicyDAO);
      const memberRepository = manager.getRepository(MemberDAO);
      const adminLogRepository = manager.getRepository(AdminLogDAO);
      const activePresetPolicies = await presetPolicyRepository.find({
        relations: { preset: true, policy: true },
        where: {
          preset: { isActive: true },
        },
        order: { policyId: 'ASC' },
      });
      const activePolicyContents = new Set(
        activePresetPolicies.map(({ policy }) =>
          this.toMaskingContent(policy.maskingContent)),
      );
      const policies = await this.findMasterPolicies(
        policyRepository,
        requestedPolicies.filter((policy) => activePolicyContents.has(policy)),
      );

      // 분석 이력은 department_policy_id를 FK로 참조합니다. 기존 연결을 삭제하지
      // 않고 비활성화한 뒤, 요청된 항목만 다시 활성화하여 이력을 보존합니다.
      await departmentPolicyRepository.update({
        departmentId: lockedDepartment.departmentId,
      }, {
        isActive: false,
      });

      if (policies.length > 0) {
        await departmentPolicyRepository.upsert(
          policies.map((policy) => ({
            departmentId: lockedDepartment.departmentId,
            policyId: policy.policyId,
            isActive: true,
          })),
          ['departmentId', 'policyId'],
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
  ): Promise<AdminResDTO.PolicyList | null> {
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
    if (policies.length === 0) {
      return null;
    }
    return AdminMapper.toPolicyList(department.departmentName, policies);
  }

  /** 저장된 모든 보안 정책 프리셋과 프리셋별 정책 목록입니다. */
  async getPolicyCatalog(): Promise<AdminResDTO.PolicyPreset[] | null> {
    const presets = await this.dataSource.getRepository(PresetDAO).find({
      select: {
        policyPresetId: true,
        name: true,
        isActive: true,
        presetPolicies: {
          presetPolicyId: true,
          policy: { policyId: true, maskingContent: true },
        },
      },
      relations: {
        presetPolicies: { policy: true },
      },
      order: {
        policyPresetId: 'ASC',
        presetPolicies: { policy: { policyId: 'ASC' } },
      },
    });

    return presets.length === 0
      ? null
      : AdminMapper.toPolicyPresetList(presets);
  }

  /** 보안 정책 프리셋을 생성하거나, 기존 프리셋을 활성화합니다. */
  async syncGlobalPolicies(
    dto: Readonly<AdminReqDTO.SyncGlobalPolicies>,
    authentication: Readonly<AuthenticatedUser>,
  ): Promise<string[]> {
    if (authentication.role !== UserRole.TOTAL_ADMIN) {
      throw new SecurityException(SecurityErrorStatus.FORBIDDEN);
    }

    const presetName = this.normalizePolicyPresetName(dto.presetName);

    if (dto.policies === undefined) {
      return this.dataSource.transaction(async (manager) => {
        const presetRepository = manager.getRepository(PresetDAO);
        const departmentPolicyRepository =
          manager.getRepository(DepartmentPolicyDAO);
        const memberRepository = manager.getRepository(MemberDAO);
        const adminLogRepository = manager.getRepository(AdminLogDAO);
        const preset = await presetRepository.findOne({
          select: {
            policyPresetId: true,
            presetPolicies: {
              presetPolicyId: true,
              policy: { policyId: true, maskingContent: true },
            },
          },
          relations: {
            presetPolicies: { policy: true },
          },
          where: { name: presetName },
          order: { policyPresetId: 'ASC' },
        });
        if (preset === null) {
          throw new AdminException(AdminErrorStatus.POLICY_NOT_FOUND);
        }

        await presetRepository.update({ isActive: true }, { isActive: false });
        await presetRepository.update(
          { policyPresetId: preset.policyPresetId },
          { isActive: true },
        );

        const policies = preset.presetPolicies ?? [];
        const policyIds = policies.map(({ policy }) => policy.policyId);
        if (policyIds.length === 0) {
          await departmentPolicyRepository.update(
            { isActive: true },
            { isActive: false },
          );
        } else {
          // 선택된 전역 프리셋에 없는 부서 정책은 활성 상태로 남을 수 없습니다.
          await departmentPolicyRepository.update({
            policyId: Not(In(policyIds)),
            isActive: true,
          }, {
            isActive: false,
          });
          await departmentPolicyRepository.update({
            policyId: In(policyIds),
            isActive: false,
          }, {
            isActive: true,
          });
        }

        const administrator = await memberRepository.findOneBy({
          memberId: String(authentication.userId),
        });
        if (administrator === null) {
          throw new AuthException(AuthErrorStatus.USER_NOT_FOUND);
        }
        await adminLogRepository.save({
          logContent: `전역 보안 정책 프리셋 ${presetName}을 동기화했습니다.`,
          actionAt: new Date(),
          actionMemberName: administrator.memberName,
        });

        return policies.map(({ policy }) =>
          getSecurityPolicyDisplayName(policy.maskingContent));
      });
    }

    const requestedPolicies = this.normalizePolicyList(dto.policies);

    return this.dataSource.transaction(async (manager) => {
      const policyRepository = manager.getRepository(PolicyDAO);
      const departmentPolicyRepository = manager.getRepository(DepartmentPolicyDAO);
      const presetRepository = manager.getRepository(PresetDAO);
      const presetPolicyRepository = manager.getRepository(PresetPolicyDAO);
      const memberRepository = manager.getRepository(MemberDAO);
      const adminLogRepository = manager.getRepository(AdminLogDAO);
      const policies = await this.findMasterPolicies(
        policyRepository,
        requestedPolicies,
      );

      let preset = await presetRepository.findOne({
        select: { policyPresetId: true },
        where: { name: presetName },
        order: { policyPresetId: 'ASC' },
      });
      // 기업에서 선택한 프리셋만 활성 상태로 유지합니다.
      await presetRepository.update({ isActive: true }, { isActive: false });
      if (preset === null) {
        preset = await presetRepository.save(
          presetRepository.create({ name: presetName, isActive: true }),
        );
      } else {
        await presetRepository.update(
          { policyPresetId: preset.policyPresetId },
          { isActive: true },
        );
      }

      await presetPolicyRepository.delete({
        policyPresetId: preset.policyPresetId,
      });
      if (policies.length > 0) {
        await presetPolicyRepository.save(
          policies.map((policy) => ({
            policyPresetId: preset.policyPresetId,
            policyId: policy.policyId,
          })),
        );
      }

      // 전역 보안 정책의 활성 여부는 활성 프리셋에 포함됐는지로만 판단합니다.
      // 프리셋에 없는 부서 정책은 활성 상태로 남기지 않습니다.
      const policyIds = policies.map((policy) => policy.policyId);
      if (policyIds.length === 0) {
        await departmentPolicyRepository.update(
          { isActive: true },
          { isActive: false },
        );
      } else {
        await departmentPolicyRepository.update({
          policyId: Not(In(policyIds)),
          isActive: true,
        }, {
          isActive: false,
        });
        await departmentPolicyRepository.update({
          policyId: In(policyIds),
          isActive: false,
        }, {
          isActive: true,
        });
      }

      const administrator = await memberRepository.findOneBy({
        memberId: String(authentication.userId),
      });
      if (administrator === null) {
        throw new AuthException(AuthErrorStatus.USER_NOT_FOUND);
      }
      await adminLogRepository.save({
        logContent: `전역 보안 정책 프리셋 ${presetName}을 동기화했습니다.`,
        actionAt: new Date(),
        actionMemberName: administrator.memberName,
      });

      return policies.map((policy) =>
        getSecurityPolicyDisplayName(policy.maskingContent));
    });
  }

  /** DB·MinIO·NER·Provider와 애플리케이션 내부 구성 요소를 점검해 기록합니다. */
  async checkAndRecordSystemHealth(): Promise<void> {
    const [database, storage, inboundLlm, outboundLlm] = await Promise.all([
      this.checkDatabaseHealth(),
      this.checkStorageHealth(),
      this.checkNerHealth(),
      this.checkProviderHealth(),
    ]);
    const currentInfrastructure = [
      this.createHealthHistory(HealthServiceName.SECURITY_FILTERING, HealthStatus.OK),
      this.createHealthHistory(
        HealthServiceName.LOCAL_LLM,
        inboundLlm.status,
        inboundLlm.latency,
      ),
      ...OUTBOUND_LLM_SERVICES.map((serviceName) =>
        this.createHealthHistory(
          serviceName,
          outboundLlm.status,
          outboundLlm.latency,
        )),
      this.createHealthHistory(
        HealthServiceName.DATABASE,
        database.status,
        database.latency,
      ),
      this.createHealthHistory(
        HealthServiceName.STORAGE,
        storage.status,
        storage.latency,
      ),
      this.createHealthHistory(HealthServiceName.MONITORING, HealthStatus.OK),
    ];
    await this.healthHistoryRepository.save(currentInfrastructure);
  }

  /** 보관 기간(3일)이 지난 상태 점검 이력을 삭제합니다. */
  async deleteExpiredHealthHistories(now = new Date()): Promise<void> {
    const retentionBoundary = new Date(
      now.getTime() - (3 * 24 * 60 * 60 * 1_000),
    );
    await this.healthHistoryRepository.delete({
      createdAt: LessThanOrEqual(retentionBoundary),
    });
  }

  /** health_history의 서비스별 최신 레코드를 읽어 시스템 상태를 집계합니다. */
  async getSystemHealth(): Promise<AdminResDTO.SystemHealth> {
    const histories = await this.healthHistoryRepository.find({
      where: {
        serviceName: In([
          ...OUTBOUND_LLM_SERVICES,
          HealthServiceName.LOCAL_LLM,
          HealthServiceName.SECURITY_FILTERING,
          HealthServiceName.DATABASE,
          HealthServiceName.STORAGE,
          HealthServiceName.MONITORING,
        ]),
      },
      order: { healthHistoryId: 'DESC' },
    });
    const latestByService = this.getLatestHealthByService(histories);
    const outboundLLM = this.aggregateHealthStatuses(
      OUTBOUND_LLM_SERVICES.map((serviceName) =>
        this.toSystemHealthStatus(latestByService.get(serviceName)),
      ),
    );
    const inboundLLM = this.aggregateHealthStatuses([
      this.toSystemHealthStatus(latestByService.get(HealthServiceName.LOCAL_LLM)),
    ]);
    const securityFiltering = this.toSystemHealthStatus(
      latestByService.get(HealthServiceName.SECURITY_FILTERING),
    );
    const database = this.toSystemHealthStatus(
      latestByService.get(HealthServiceName.DATABASE),
    );
    const storage = this.toSystemHealthStatus(
      latestByService.get(HealthServiceName.STORAGE),
    );
    const monitoring = this.toSystemHealthStatus(
      latestByService.get(HealthServiceName.MONITORING),
    );

    return {
      totalSystemHealth: this.aggregateHealthStatuses([
        outboundLLM,
        inboundLLM,
        securityFiltering,
        database,
        storage,
        monitoring,
      ]),
      outboundLLM,
      inboundLLM,
      securityFiltering,
      database,
      storage,
      monitoring,
    };
  }

  /** 서비스별 최근 상태 이력으로 모델 가용성·P95 지연시간을 계산합니다. */
  async getLlmHealth(): Promise<AdminResDTO.LlmHealth[]> {
    const histories = await this.healthHistoryRepository.find({
      select: {
        healthHistoryId: true,
        serviceName: true,
        status: true,
        latency: true,
      },
      where: { serviceName: In([...MODEL_HEALTH_SERVICES]) },
      order: { healthHistoryId: 'DESC' },
    });
    const historiesByService = new Map<string, HealthHistoryDAO[]>();

    for (const healthHistory of histories) {
      const serviceHistories = historiesByService.get(healthHistory.serviceName)
        ?? [];
      if (serviceHistories.length >= MODEL_HEALTH_HISTORY_LIMIT) {
        continue;
      }
      serviceHistories.push(healthHistory);
      historiesByService.set(healthHistory.serviceName, serviceHistories);
    }

    return MODEL_HEALTH_SERVICES.map((service) =>
      this.toLlmHealth(service, historiesByService.get(service) ?? []),
    );
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
          "COUNT(DISTINCT CASE WHEN maskingDetail.maskingDetailId IS NOT NULL AND promptLog.status != :errorStatus AND LOWER(promptLog.modelType) LIKE 'gpt%' THEN promptLog.promptLogId END)",
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
        .setParameters({
          recentSince,
          previousSince,
          errorStatus: PromptLogStatus.ERROR,
        })
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
      updatedAt: toKoreaStandardTimeISOString(updatedAt),
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
        DepartmentPolicyDAO,
        'departmentPolicy',
        'departmentPolicy.policyId = policy.policyId',
      )
      .leftJoin(
        MaskingDetailDAO,
        'maskingDetail',
        'maskingDetail.departmentPolicyId = departmentPolicy.departmentPolicyId',
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
        'memberDepartment',
        'memberDepartment.departmentId = department.departmentId',
      )
      .leftJoin(
        PromptRoomDAO,
        'promptRoom',
        'promptRoom.memberId = memberDepartment.memberId',
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
      .addSelect('COUNT(DISTINCT memberDepartment.memberId)', 'userCnt')
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
    const newUserSince = new Date(Date.UTC(
      updatedAt.getUTCFullYear(),
      updatedAt.getUTCMonth(),
      1,
    ));

    const departmentId = authentication.role === UserRole.DEPART_ADMIN
      ? (await this.findDepartmentByUserId(authentication.userId)).departmentId
      : undefined;
    const queryBuilder = this.memberRepository
      .createQueryBuilder('member')
      .leftJoin(
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
      .select('COUNT(DISTINCT member.memberId)', 'totalUserCnt')
      .addSelect(
        'COUNT(DISTINCT CASE WHEN member.disabledAt IS NULL THEN member.memberId END)',
        'activateUserCnt',
      )
      .addSelect(
        'COUNT(DISTINCT CASE WHEN member.disabledAt IS NOT NULL THEN member.memberId END)',
        'disabledUserCnt',
      )
      .addSelect(
        'COUNT(DISTINCT CASE WHEN member.createdAt >= :newUserSince THEN member.memberId END)',
        'newUserCnt',
      )
      .setParameter('newUserSince', newUserSince)
      .getRawOne<UserSummaryRaw>();

    return AdminMapper.toUserSummary(
      toKoreaStandardTimeISOString(updatedAt),
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
      .leftJoin(
        MemberDepartmentDAO,
        'membership',
        'membership.memberId = member.memberId',
      )
      .leftJoin(
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
        'promptLog.promptRoomId = promptRoom.promptRoomId AND promptLog.communicatedAt IS NOT NULL',
      )
      .leftJoin(
        MaskingDetailDAO,
        'maskingDetail',
        'maskingDetail.maskingReportId = promptLog.maskingReportId',
      )
      .where('member.memberId = :userId', { userId: String(userId) })
      .andWhere('member.disabledAt IS NULL');

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
      .addSelect('COUNT(DISTINCT promptLog.promptLogId)', 'chatCnt')
      .addSelect(
        'COUNT(DISTINCT CASE WHEN maskingDetail.maskingDetailId IS NOT NULL THEN promptLog.promptLogId END)',
        'filterDetectCnt',
      )
      .addSelect(
        "COUNT(DISTINCT CASE WHEN maskingDetail.maskingDetailId IS NOT NULL AND LOWER(promptLog.modelType) NOT LIKE 'local%' THEN promptLog.promptLogId END)",
        'masking',
      )
      .addSelect(
        "COUNT(DISTINCT CASE WHEN LOWER(promptLog.modelType) LIKE 'local%' THEN promptLog.promptLogId END)",
        'local',
      )
      .groupBy('member.memberId')
      .addGroupBy('department.departmentId')
      .getRawOne<UserDetailRaw>();

    if (detail === undefined) {
      throw new AuthException(AuthErrorStatus.USER_NOT_FOUND);
    }

    const memberLimits = await this.memberLimitRepository.find({
      select: { limit: true, usage: true },
      where: { memberId: String(userId) },
    });
    const { limit, usage } = this.toMemberLimitTotals(memberLimits);

    return AdminMapper.toUserDetail({
      name: detail.name,
      email: detail.email,
      department: detail.department,
      role: this.toRoleName(detail.role),
      createdAt: this.toDateTimeString(detail.createdAt),
      createdBy: detail.createdBy,
      limit,
      usage,
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
        toKoreaStandardTimeISOString(member.disabledAt),
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
        toKoreaStandardTimeISOString(current.disabledAt),
      );
    }

    await this.recordAdminActivity(
      authentication.userId,
      `${member.memberName} 사용자 계정을 비활성화했습니다.`,
    );

    return AdminMapper.toDisableUser(
      member.memberName,
      toKoreaStandardTimeISOString(disabledAt),
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
      toKoreaStandardTimeISOString(restoredAt),
    );
  }

  async updateUser(userId: number, dto: unknown): Promise<AdminResDTO.UpdateUser> {
    void userId;
    void dto;
    return AdminMapper.toUnknown(null);
  }

  async getLogsSummary(): Promise<AdminResDTO.LogsSummary> {
    const summary = await this.dataSource
      .getRepository(PromptLogDAO)
      .createQueryBuilder('promptLog')
      .leftJoin(
        MaskingDetailDAO,
        'maskingDetail',
        'maskingDetail.maskingReportId = promptLog.maskingReportId',
      )
      .where('promptLog.status != :maskingStatus', {
        maskingStatus: PromptLogStatus.MASKING,
      })
      .select('COUNT(DISTINCT promptLog.promptLogId)', 'totalChatCnt')
      .addSelect(
        'COUNT(DISTINCT CASE WHEN maskingDetail.maskingDetailId IS NOT NULL THEN promptLog.promptLogId END)',
        'filterDetectCnt',
      )
      .addSelect(
        "COUNT(DISTINCT CASE WHEN maskingDetail.maskingDetailId IS NOT NULL AND LOWER(promptLog.modelType) NOT LIKE 'local%' THEN promptLog.promptLogId END)",
        'masking',
      )
      .addSelect(
        "COUNT(DISTINCT CASE WHEN LOWER(promptLog.modelType) LIKE 'local%' THEN promptLog.promptLogId END)",
        'local',
      )
      .getRawOne<LogsSummaryRaw>();
    const totalChatCnt = Number(summary?.totalChatCnt ?? 0);
    const filterDetectCnt = Number(summary?.filterDetectCnt ?? 0);
    const masking = Number(summary?.masking ?? 0);
    const local = Number(summary?.local ?? 0);
    const localRate = filterDetectCnt === 0
      ? 0
      : (local / filterDetectCnt) * 100;

    return AdminMapper.toLogsSummary(
      toKoreaStandardTimeISOString(new Date()),
      totalChatCnt,
      filterDetectCnt,
      masking,
      local,
      localRate,
    );
  }

  async getUserPromptOverview(
    dto: AdminReqDTO.UserPromptOverview,
  ): Promise<AdminResDTO.UserPromptOverview | null> {
    const query = this.normalizeUserPromptOverviewQuery(dto);
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
      .where('member.disabledAt IS NULL')
      .andWhere(
        '(member.memberName LIKE :query OR department.departmentName LIKE :query)',
        { query: `%${this.escapeLikePattern(query.query)}%` },
      );

    const totalCnt = await queryBuilder.clone().getCount();
    if (totalCnt === 0) {
      return null;
    }

    const users = await queryBuilder
      .select('member.memberId', 'userId')
      .addSelect('member.memberName', 'name')
      .addSelect('department.departmentName', 'department')
      .orderBy('member.memberName', 'ASC')
      .addOrderBy('member.memberId', 'ASC')
      .offset((query.pageNumber - 1) * query.pageSize)
      .limit(query.pageSize)
      .getRawMany<UserPromptOverviewRaw>();
    if (users.length === 0) {
      return null;
    }

    const userIds = users.map((user) => user.userId);
    const memberLimits = await this.memberLimitRepository.find({
      select: { memberId: true, limit: true, usage: true },
      where: { memberId: In(userIds) },
      order: { memberId: 'ASC', memberLimitId: 'ASC' },
    });
    const limitsByUserId = new Map<string, MemberLimitDAO[]>();
    for (const memberLimit of memberLimits) {
      const limits = limitsByUserId.get(memberLimit.memberId);
      if (limits === undefined) {
        limitsByUserId.set(memberLimit.memberId, [memberLimit]);
      } else {
        limits.push(memberLimit);
      }
    }

    return {
      data: users.map((user) => {
        const limit = this.toMemberLimitTotals(
          limitsByUserId.get(user.userId) ?? [],
        );
        return {
          userId: Number(user.userId),
          name: user.name,
          department: user.department,
          usage: limit.usage,
          limit: limit.limit,
        };
      }),
      totalCnt,
      dataCnt: users.length,
      pageNumber: query.pageNumber,
    };
  }

  async getUserPromptList(
    userId: number,
    dto: AdminReqDTO.UserPromptList,
  ): Promise<AdminResDTO.UserPromptList> {
    const query = this.normalizeUserPromptListQuery(dto);
    const [promptLogs, totalCnt] = await this.dataSource
      .getRepository(PromptLogDAO)
      .findAndCount({
        select: {
          // 관계 조인 + 페이지네이션에서 TypeORM이 생성하는 DISTINCT 정렬 쿼리는
          // ORDER BY 기본키를 SELECT에 포함해야 합니다. 응답에는 사용하지 않습니다.
          promptLogId: true,
          maskingReportId: true,
          promptSummary: true,
          communicatedAt: true,
          modelType: true,
          usage: true,
        },
        relations: { promptRoom: true },
        where: {
          status: Not(PromptLogStatus.MASKING),
          communicatedAt: Not(IsNull()),
          promptRoom: { memberId: String(userId) },
        },
        order: { communicatedAt: 'DESC', promptLogId: 'DESC' },
        take: query.pageSize,
        skip: (query.pageNumber - 1) * query.pageSize,
      });

    return {
      data: promptLogs.map((promptLog) => ({
        promptId: promptLog.maskingReportId,
        promptSummary: promptLog.promptSummary,
        promptedAt: this.toDateTimeString(promptLog.communicatedAt!),
        model: promptLog.modelType ?? '',
        usage: Number(promptLog.usage ?? 0),
      })),
      totalCnt,
      dataCnt: promptLogs.length,
      pageNumber: query.pageNumber,
    };
  }

  async getPromptDetail(promptId: string): Promise<AdminResDTO.PromptDetail> {
    const promptLog = await this.dataSource.getRepository(PromptLogDAO).findOne({
      select: {
        promptLogId: true,
        communicatedAt: true,
        usage: true,
        maskingReportId: true,
        promptRoom: {
          memberId: true,
          member: { memberId: true, memberName: true, email: true },
        },
        maskingReport: { originalText: true, createdAt: true },
      },
      relations: {
        promptRoom: { member: true },
        maskingReport: true,
      },
      where: { promptLogId: promptId },
    });
    if (promptLog === null) {
      throw new PromptException(PromptErrorStatus.NOT_FOUND_PROMPT);
    }

    const [membership, memberLimits, maskingDetails] = await Promise.all([
      this.memberDepartmentRepository.findOne({
        select: {
          departmentId: true,
          department: { departmentName: true },
        },
        relations: { department: true },
        where: { memberId: promptLog.promptRoom.memberId },
        order: { memberDepartmentId: 'ASC' },
      }),
      this.memberLimitRepository.find({
        select: { limit: true, usage: true },
        where: { memberId: promptLog.promptRoom.memberId },
      }),
      this.dataSource.getRepository(MaskingDetailDAO).find({
        select: {
          maskingDetailId: true,
          originalText: true,
          startIdx: true,
          maskingText: true,
          departmentPolicy: {
            policy: { maskingContent: true, maskingClass: true },
          },
        },
        relations: { departmentPolicy: { policy: true } },
        where: { maskingReportId: promptLog.maskingReportId },
        order: { maskingDetailId: 'ASC' },
      }),
    ]);
    if (membership === null) {
      throw new PromptException(PromptErrorStatus.NOT_FOUND_PROMPT);
    }

    const detect: AdminResDTO.PromptDetection[] = [];
    for (const detail of maskingDetails) {
      if (
        detail.originalText === null
        || detail.startIdx === null
        || detail.maskingText === null
      ) {
        continue;
      }

      detect.push({
        targetText: detail.originalText,
        startIdx: detail.startIdx,
        endIdx: detail.startIdx + detail.originalText.length - 1,
        maskingCategory: getSecurityPolicyClassDisplayName(
          detail.departmentPolicy.policy.maskingClass,
        ),
        detailCategory: getSecurityPolicyDisplayName(
          detail.departmentPolicy.policy.maskingContent,
        ),
        maskingText: detail.maskingText,
        maskingStartIdx: detail.startIdx,
        maskingEndIdx: detail.startIdx + detail.maskingText.length - 1,
      });
    }

    const { limit } = this.toMemberLimitTotals(memberLimits);
    const usage = Number(promptLog.usage ?? 0);
    return {
      name: promptLog.promptRoom.member.memberName,
      department: membership.department.departmentName,
      email: promptLog.promptRoom.member.email,
      limit,
      usage,
      usagePercent: this.toRatioPercent(usage, limit),
      promptedAt: this.toDateTimeString(
        promptLog.communicatedAt ?? promptLog.maskingReport.createdAt,
      ),
      detectCnt: maskingDetails.length,
      maskingCnt: detect.length,
      originalText: promptLog.maskingReport.originalText,
      sendText: this.toMaskedPromptText(
        promptLog.maskingReport.originalText,
        detect,
      ),
      detect,
    };
  }

  private async checkDatabaseHealth(): Promise<HealthCheckResult> {
    const startedAt = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
      return this.toHealthCheckResult(true, startedAt);
    } catch {
      return this.toHealthCheckResult(false, startedAt);
    }
  }

  private async checkStorageHealth(): Promise<HealthCheckResult> {
    const startedAt = Date.now();
    try {
      return this.toHealthCheckResult(
        await this.objectStorage.isHealthy(),
        startedAt,
      );
    } catch {
      return this.toHealthCheckResult(false, startedAt);
    }
  }

  /** NER는 내부 LLM 경로의 상태로 기록합니다. */
  private async checkNerHealth(): Promise<HealthCheckResult> {
    if (this.nerConfig === undefined) {
      return { status: HealthStatus.CHECK, latency: 0 };
    }

    return this.checkHttpServerHealth(
      this.nerConfig.healthUrl,
      this.nerConfig.requestTimeoutMs,
    );
  }

  /** Provider는 GPT·Gemini·Claude의 공통 외부 LLM 관문 상태로 기록합니다. */
  private async checkProviderHealth(): Promise<HealthCheckResult> {
    if (this.providerConfig === undefined) {
      return { status: HealthStatus.CHECK, latency: 0 };
    }

    return this.checkHttpServerHealth(
      this.providerConfig.healthUrl,
      this.providerConfig.requestTimeoutMs,
    );
  }

  private async checkHttpServerHealth(
    endpoint: string,
    timeoutMs: number,
  ): Promise<HealthCheckResult> {
    const startedAt = Date.now();
    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      return this.toHealthCheckResult(response.ok, startedAt);
    } catch {
      return this.toHealthCheckResult(false, startedAt);
    }
  }

  /**
   * 상태 점검 대상이 응답하지 않거나 5xx 등으로 실패하면 ERROR를, 정상 응답이
   * 1초 이상 걸리면 DELAY를 기록합니다. MinIO SDK의 5xx 예외는 isHealthy가
   * false로 변환하므로 동일하게 ERROR로 저장됩니다.
   */
  private toHealthCheckResult(
    isAvailable: boolean,
    startedAt: number,
  ): HealthCheckResult {
    const latency = Math.max(0, Date.now() - startedAt);
    return {
      status: !isAvailable
        ? HealthStatus.ERROR
        : latency >= DELAY_LATENCY_MS
          ? HealthStatus.DELAY
          : HealthStatus.OK,
      latency,
    };
  }

  private createHealthHistory(
    serviceName: string,
    status: HealthStatus,
    latency = 0,
  ): HealthHistoryDAO {
    return this.healthHistoryRepository.create({
      serviceName,
      status,
      latency,
    });
  }

  private getLatestHealthByService(
    histories: readonly HealthHistoryDAO[],
  ): ReadonlyMap<string, HealthStatus> {
    const latestByService = new Map<string, HealthStatus>();

    for (const history of histories) {
      if (!latestByService.has(history.serviceName)) {
        latestByService.set(history.serviceName, history.status);
      }
    }

    return latestByService;
  }

  private toSystemHealthStatus(
    status: HealthStatus | undefined,
  ): SystemHealthValue {
    return status === undefined
      ? '점검'
      : SYSTEM_HEALTH_STATUS_BY_HISTORY[status];
  }

  private toLlmHealth(
    service: string,
    latestFirstHistories: readonly HealthHistoryDAO[],
  ): AdminResDTO.LlmHealth {
    const totalHistoryCount = latestFirstHistories.length;
    const averageResponse = this.toP95Latency(latestFirstHistories);
    // 현재 상태는 P95 보정 없이 가장 최근 health_history 상태를 그대로 사용합니다.
    const currentStatus = latestFirstHistories[0]?.status ?? HealthStatus.CHECK;
    const availability = totalHistoryCount === 0
      ? 0
      : Math.round(
        (latestFirstHistories.filter(({ status }) => status === HealthStatus.OK).length
          * 100)
        / totalHistoryCount,
      );
    const history = latestFirstHistories
      .slice()
      .reverse()
      .map(({ status }) => MODEL_HISTORY_STATUS_VALUE[status]);

    return {
      service,
      currentStatus,
      availability,
      averageResponse,
      history: [
        ...Array<number>(MODEL_HEALTH_HISTORY_LIMIT - history.length).fill(
          MODEL_HISTORY_STATUS_VALUE[HealthStatus.CHECK],
        ),
        ...history,
      ],
    };
  }

  /** 최근 이력의 nearest-rank 방식 P95 지연시간(ms)을 반환합니다. */
  private toP95Latency(histories: readonly HealthHistoryDAO[]): number {
    if (histories.length === 0) {
      return 0;
    }

    const latencies = histories
      .map(({ latency }) => Math.max(0, Math.trunc(Number(latency))))
      .sort((left, right) => left - right);
    const percentileIndex = Math.ceil(latencies.length * 0.95) - 1;
    return latencies[percentileIndex]!;
  }

  private aggregateHealthStatuses(
    statuses: readonly SystemHealthValue[],
  ): SystemHealthValue {
    return statuses.reduce<SystemHealthValue>(
      (current, status) =>
        SYSTEM_HEALTH_PRIORITY[status] > SYSTEM_HEALTH_PRIORITY[current]
          ? status
          : current,
      '정상',
    );
  }

  private isValidEmail(email: string): boolean {
    return typeof email === 'string'
      && email.length <= 255
      && EMAIL_REGEX.test(email);
  }

  private normalizeLinkDepartmentUserIds(value: unknown): number[] {
    if (!Array.isArray(value) || value.length === 0) {
      throw new AdminException(AdminErrorStatus.INVALID_USER_IDS);
    }

    if (value.some((userId) => typeof userId !== 'number')) {
      throw new AdminException(AdminErrorStatus.INVALID_USER_IDS);
    }

    const userIds = value as number[];
    if (
      userIds.some((userId) => !Number.isSafeInteger(userId) || userId <= 0)
      || new Set(userIds).size !== userIds.length
    ) {
      throw new AdminException(AdminErrorStatus.INVALID_USER_IDS);
    }

    return userIds;
  }

  private normalizePolicyPresetName(value: unknown): string {
    if (typeof value !== 'string') {
      throw new AdminException(AdminErrorStatus.INVALID_POLICY);
    }

    const policyName = value.trim();
    if (
      policyName.length === 0
      || policyName.length > 255
      || /[\r\n]/.test(policyName)
    ) {
      throw new AdminException(AdminErrorStatus.INVALID_POLICY);
    }

    return policyName;
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

  private normalizeDepartmentCode(value: unknown): string {
    if (typeof value !== 'string') {
      throw new AdminException(AdminErrorStatus.INVALID_DEPARTMENT_NAME);
    }

    const departmentCode = value.trim();
    if (
      departmentCode.length === 0
      || departmentCode.length > MAX_DEPARTMENT_CODE_LENGTH
    ) {
      throw new AdminException(AdminErrorStatus.INVALID_DEPARTMENT_NAME);
    }

    return departmentCode;
  }

  private normalizeDepartmentAdminId(value: unknown): number {
    if (
      typeof value !== 'number'
      || !Number.isSafeInteger(value)
      || value <= 0
    ) {
      throw new AdminException(AdminErrorStatus.INVALID_DEPARTMENT_ADMIN);
    }

    return value;
  }

  private normalizeDepartmentBoolean(value: unknown): boolean {
    if (typeof value !== 'boolean') {
      throw new AdminException(AdminErrorStatus.INVALID_DEPARTMENT_NAME);
    }

    return value;
  }

  private normalizeDepartmentLimit(value: unknown): string {
    if (
      typeof value !== 'number'
      || !Number.isSafeInteger(value)
      || value < 0
    ) {
      throw new AdminException(AdminErrorStatus.INVALID_DEPARTMENT_NAME);
    }

    return String(value);
  }

  /**
   * 부서 한도 0은 무제한이므로 개인 한도도 0으로 유지합니다. 유한 한도는
   * 정수 컬럼에 저장하므로 소수점 이하는 버립니다.
   */
  private divideDepartmentLimit(
    departmentLimit: string,
    memberCount: number,
  ): string {
    if (memberCount <= 0) {
      return '0';
    }

    return (BigInt(departmentLimit) / BigInt(memberCount)).toString();
  }

  private toUserRole(role: unknown): UserRole {
    switch (role) {
      case UserRole.USER:
        return UserRole.USER;
      case UserRole.DEPART_ADMIN:
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

  private toLocalLlmDeploymentCreateRequest(
    dto: Readonly<AdminReqDTO.RegisterLocalLlm>,
  ): LlmDeploymentCreateRequest {
    const adapterType = this.toLocalLlmAdapterType(dto.adapterType);
    const deploymentId = this.normalizeLocalDeploymentId(dto.deploymentId);

    if (adapterType === 'mock') {
      this.assertMockDeploymentOptionsAbsent(
        dto.baseUrl,
        dto.modelName,
        dto.timeoutMs,
      );
      return { deploymentId, adapterType, enabled: true };
    }

    const modelName = this.normalizeLocalDeploymentText(dto.modelName);
    const localModelName = toLocalLlmModelName(modelName);
    if (
      localModelName === null
      || localModelName.length > MAX_LLM_DETAIL_MODEL_NAME_LENGTH
      || deploymentId !== localModelName
    ) {
      throw new AdminException(AdminErrorStatus.INVALID_LOCAL_DEPLOYMENT);
    }

    return {
      // LPL Deployment ID와 llm_detail_model.llm_name을 동일한 canonical local-* 값으로 유지합니다.
      deploymentId: localModelName,
      adapterType,
      baseUrl: this.normalizeLocalDeploymentUrl(dto.baseUrl),
      modelName,
      timeoutMs: this.normalizeLocalDeploymentTimeout(dto.timeoutMs),
      enabled: true,
    };
  }

  private toLocalNerDeploymentCreateRequest(
    dto: Readonly<AdminReqDTO.RegisterLocalNer>,
  ): NerDeploymentCreateRequest {
    const adapterType = this.toLocalNerAdapterType(dto.adapterType);
    const deploymentId = this.normalizeLocalDeploymentId(dto.deploymentId);

    if (adapterType === 'mock') {
      this.assertMockDeploymentOptionsAbsent(dto.baseUrl, dto.timeoutMs);
      return { deploymentId, adapterType, enabled: true };
    }

    return {
      deploymentId,
      adapterType,
      baseUrl: this.normalizeLocalDeploymentUrl(dto.baseUrl),
      timeoutMs: this.normalizeLocalDeploymentTimeout(dto.timeoutMs),
      enabled: true,
    };
  }

  private toLocalLlmAdapterType(value: unknown): LlmAdapterType {
    if (
      typeof value !== 'string'
      || !LLM_ADAPTER_TYPES.includes(value as LlmAdapterType)
    ) {
      throw new AdminException(AdminErrorStatus.INVALID_LOCAL_DEPLOYMENT);
    }

    return value as LlmAdapterType;
  }

  private toLocalNerAdapterType(value: unknown): NerAdapterType {
    if (
      typeof value !== 'string'
      || !NER_ADAPTER_TYPES.includes(value as NerAdapterType)
    ) {
      throw new AdminException(AdminErrorStatus.INVALID_LOCAL_DEPLOYMENT);
    }

    return value as NerAdapterType;
  }

  private assertMockDeploymentOptionsAbsent(...options: unknown[]): void {
    if (options.some((option) => option !== undefined)) {
      throw new AdminException(AdminErrorStatus.INVALID_LOCAL_DEPLOYMENT);
    }
  }

  private normalizeLocalDeploymentText(value: unknown): string {
    if (typeof value !== 'string') {
      throw new AdminException(AdminErrorStatus.INVALID_LOCAL_DEPLOYMENT);
    }

    const text = value.trim();
    if (
      text.length === 0
      || text.length > MAX_LOCAL_DEPLOYMENT_TEXT_LENGTH
      || /[\r\n]/.test(text)
    ) {
      throw new AdminException(AdminErrorStatus.INVALID_LOCAL_DEPLOYMENT);
    }

    return text;
  }

  /**
   * 새 전역 Deployment는 Gateway의 local-* 식별자 공간을 사용합니다.
   * 상태 변경은 기존 LPL 등록 항목도 관리할 수 있도록 별도 일반 정규화를 유지합니다.
   */
  private normalizeLocalDeploymentId(value: unknown): string {
    const deploymentId = this.normalizeLocalDeploymentText(value);
    if (
      !deploymentId.startsWith(LOCAL_LLM_MODEL_PREFIX)
      || deploymentId.length === LOCAL_LLM_MODEL_PREFIX.length
    ) {
      throw new AdminException(AdminErrorStatus.INVALID_LOCAL_DEPLOYMENT);
    }

    return deploymentId;
  }

  private normalizeLocalDeploymentUrl(value: unknown): string {
    if (typeof value !== 'string') {
      throw new AdminException(AdminErrorStatus.INVALID_LOCAL_DEPLOYMENT);
    }

    const baseUrl = value.trim();
    if (
      baseUrl.length === 0
      || baseUrl.length > MAX_LOCAL_DEPLOYMENT_URL_LENGTH
      || /[\r\n]/.test(baseUrl)
    ) {
      throw new AdminException(AdminErrorStatus.INVALID_LOCAL_DEPLOYMENT);
    }

    try {
      const url = new URL(baseUrl);
      if (
        (url.protocol !== 'http:' && url.protocol !== 'https:')
        || url.username.length > 0
        || url.password.length > 0
      ) {
        throw new TypeError('허용하지 않는 로컬 Deployment URL입니다.');
      }
    } catch {
      throw new AdminException(AdminErrorStatus.INVALID_LOCAL_DEPLOYMENT);
    }

    return baseUrl;
  }

  private normalizeLocalDeploymentTimeout(value: unknown): number {
    if (
      typeof value !== 'number'
      || !Number.isSafeInteger(value)
      || value <= 0
      || value > MAX_LOCAL_DEPLOYMENT_TIMEOUT_MS
    ) {
      throw new AdminException(AdminErrorStatus.INVALID_LOCAL_DEPLOYMENT);
    }

    return value;
  }

  private toLocalDeploymentStatusUpdateRequest(
    dto: Readonly<AdminReqDTO.UpdateLocalDeploymentStatus>,
  ): boolean {
    if (
      typeof dto !== 'object'
      || dto === null
      || Array.isArray(dto)
      || Object.keys(dto).length !== 1
      || !Object.prototype.hasOwnProperty.call(dto, 'enabled')
      || typeof dto.enabled !== 'boolean'
    ) {
      throw new AdminException(AdminErrorStatus.INVALID_LOCAL_DEPLOYMENT_STATE);
    }

    return dto.enabled;
  }

  private async createLlmDeployment(
    request: Readonly<LlmDeploymentCreateRequest>,
  ) {
    try {
      return await this.getNerClient().createLlmDeployment(request);
    } catch (error: unknown) {
      this.throwDeploymentRegistrationError(error);
    }
  }

  private async createNerDeployment(
    request: Readonly<NerDeploymentCreateRequest>,
  ) {
    try {
      return await this.getNerClient().createNerDeployment(request);
    } catch (error: unknown) {
      this.throwDeploymentRegistrationError(error);
    }
  }

  private async updateLlmDeploymentEnabled(
    deploymentId: string,
    enabled: boolean,
  ): Promise<NerLlmDeploymentDetail> {
    try {
      return await this.getNerClient().updateLlmDeploymentEnabled(
        deploymentId,
        enabled,
      );
    } catch (error: unknown) {
      this.throwDeploymentStateUpdateError(error);
    }
  }

  private async updateNerDeploymentEnabled(
    deploymentId: string,
    enabled: boolean,
  ): Promise<NerDeploymentDetail> {
    try {
      return await this.getNerClient().updateNerDeploymentEnabled(
        deploymentId,
        enabled,
      );
    } catch (error: unknown) {
      this.throwDeploymentStateUpdateError(error);
    }
  }

  /**
   * LPL Registry의 활성 로컬 LLM 모델을 DB 카탈로그와 부서별 Local LLM
   * 연결에 동기화합니다. Local LLM은 외부 Provider API 키와 분리됩니다.
   */
  private async syncEnabledLocalLlmModels(): Promise<void> {
    const localModelNames = await this.getEnabledLocalLlmModelNames();

    await this.syncEnabledLocalLlmModelsByNames(localModelNames);
  }

  private async getEnabledLocalLlmModelNames(): Promise<readonly string[]> {
    try {
      return this.toEnabledLocalLlmModelNames(
        await this.getNerClient().getEnabledLlmModelNames(),
      );
    } catch (error: unknown) {
      this.throwDeploymentRegistrationError(error);
    }
  }

  private async syncEnabledLocalLlmModelsByNames(
    localModelNames: readonly string[],
  ): Promise<void> {
    if (localModelNames.length === 0) {
      return;
    }

    try {
      await this.dataSource.transaction(async (manager) => {
        const llmDetailModelRepository = manager.getRepository(
          LlmDetailModelDAO,
        );
        const activeApiKeyRepository = manager.getRepository(ActiveApiKeyDAO);
        const activeLlmRepository = manager.getRepository(ActiveLlmDAO);
        const existingModels = await llmDetailModelRepository.find({
          select: { llmName: true },
          where: { llmName: In(localModelNames) },
        });
        const existingNames = new Set(
          existingModels.flatMap((model) => model.llmName === null
            ? []
            : [model.llmName.toLowerCase()]),
        );
        const missingModelNames = localModelNames.filter(
          (modelName) => !existingNames.has(modelName.toLowerCase()),
        );

        if (missingModelNames.length > 0) {
          await llmDetailModelRepository.insert(
            missingModelNames.map((llmName) => ({ llmName })),
          );
        }

        const [models, activeApiKeys] = await Promise.all([
          llmDetailModelRepository.find({
            select: { llmDetailModelId: true },
            where: { llmName: In(localModelNames) },
          }),
          activeApiKeyRepository.find({
            select: { activeApiKeyId: true },
            where: { serviceType: LOCAL_LLM_MODEL },
          }),
        ]);
        if (models.length === 0 || activeApiKeys.length === 0) {
          return;
        }

        await activeLlmRepository.upsert(
          activeApiKeys.flatMap((activeApiKey) => models.map((model) => ({
            activeApiKeyId: activeApiKey.activeApiKeyId,
            llmDetailModelId: model.llmDetailModelId,
          }))),
          ['activeApiKeyId', 'llmDetailModelId'],
        );
      });
    } catch (error: unknown) {
      this.throwDeploymentRegistrationError(error);
    }
  }

  /**
   * LPL 상태 변경 후 해당 모델의 부서별 사용 가능 연결을 동기화합니다.
   * llm_detail_model은 전역 카탈로그이므로 삭제하지 않고 active_llm만 변경합니다.
   */
  private async synchronizeUpdatedLocalLlmAvailability(
    deployment: Readonly<NerLlmDeploymentDetail>,
  ): Promise<void> {
    if (deployment.modelName === undefined) {
      return;
    }

    const localModelName = toLocalLlmModelName(deployment.modelName);
    if (
      localModelName === null
      || localModelName.length > MAX_LLM_DETAIL_MODEL_NAME_LENGTH
    ) {
      throw new AdminException(
        AdminErrorStatus.INVALID_LOCAL_DEPLOYMENT_CONFIGURATION,
      );
    }

    if (deployment.enabled) {
      await this.syncEnabledLocalLlmModels();
      return;
    }

    const enabledLocalModelNames = await this.getEnabledLocalLlmModelNames();
    const isStillEnabledByAnotherDeployment = enabledLocalModelNames.some(
      (enabledLocalModelName) => (
        enabledLocalModelName.toLowerCase() === localModelName.toLowerCase()
      ),
    );
    if (isStillEnabledByAnotherDeployment) {
      await this.syncEnabledLocalLlmModelsByNames(enabledLocalModelNames);
      return;
    }

    await this.deactivateLocalLlmModel(localModelName);
  }

  private async deactivateLocalLlmModel(
    localModelName: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const llmDetailModelRepository = manager.getRepository(
        LlmDetailModelDAO,
      );
      const activeApiKeyRepository = manager.getRepository(ActiveApiKeyDAO);
      const activeLlmRepository = manager.getRepository(ActiveLlmDAO);
      const models = await llmDetailModelRepository.find({
        select: { llmDetailModelId: true },
        where: {
          llmName: Raw(
            (column) => `LOWER(${column}) = :localModelName`,
            { localModelName: localModelName.toLowerCase() },
          ),
        },
      });
      if (models.length === 0) {
        return;
      }

      const localLlmActiveApiKeys = await activeApiKeyRepository.find({
        select: { activeApiKeyId: true },
        where: { serviceType: LOCAL_LLM_MODEL },
      });
      if (localLlmActiveApiKeys.length === 0) {
        return;
      }

      await activeLlmRepository.delete({
        activeApiKeyId: In(
          localLlmActiveApiKeys.map((activeApiKey) => (
            activeApiKey.activeApiKeyId
          )),
        ),
        llmDetailModelId: In(models.map((model) => model.llmDetailModelId)),
      });
    });
  }

  /** 새 부서의 Local LLM 키에 현재 활성 local-* 카탈로그 모델을 연결합니다. */
  private async linkLocalLlmModelsToActiveApiKey(
    manager: EntityManager,
    activeApiKeyId: string,
    localModelNames: readonly string[],
  ): Promise<void> {
    if (localModelNames.length === 0) {
      return;
    }

    const llmDetailModelRepository = manager.getRepository(LlmDetailModelDAO);
    const activeLlmRepository = manager.getRepository(ActiveLlmDAO);
    const localLlmModels = await llmDetailModelRepository.find({
      select: { llmDetailModelId: true },
      where: { llmName: In(localModelNames) },
    });
    if (localLlmModels.length === 0) {
      return;
    }

    await activeLlmRepository.upsert(
      localLlmModels.map((localLlmModel) => ({
        activeApiKeyId,
        llmDetailModelId: localLlmModel.llmDetailModelId,
      })),
      ['activeApiKeyId', 'llmDetailModelId'],
    );
  }

  private toEnabledLocalLlmModelNames(
    modelNames: readonly string[],
  ): readonly string[] {
    const localModelNames = new Set<string>();

    for (const modelName of modelNames) {
      const localModelName = toLocalLlmModelName(modelName);
      if (
        localModelName === null
        || localModelName.length > MAX_LLM_DETAIL_MODEL_NAME_LENGTH
      ) {
        throw new AdminException(
          AdminErrorStatus.INVALID_LOCAL_DEPLOYMENT_CONFIGURATION,
        );
      }
      localModelNames.add(localModelName);
    }

    return [...localModelNames];
  }

  private getNerClient(): NerClient {
    if (this.nerClient === undefined) {
      throw new AdminException(
        AdminErrorStatus.LOCAL_DEPLOYMENT_PROVIDER_UNAVAILABLE,
      );
    }

    return this.nerClient;
  }

  private async getLocalDeploymentSummaries(
    findDeployments: () => Promise<readonly NerDeploymentSummary[]>,
  ): Promise<AdminResDTO.LocalDeployment[]> {
    try {
      return (await findDeployments()).map(({ deploymentId, enabled }) => ({
        deploymentId,
        enabled,
      }));
    } catch (error: unknown) {
      if (error instanceof NerRequestException) {
        throw new AdminException(
          AdminErrorStatus.LOCAL_DEPLOYMENT_PROVIDER_UNAVAILABLE,
        );
      }
      throw error;
    }
  }

  private throwDeploymentRegistrationError(error: unknown): never {
    if (error instanceof NerRequestException) {
      if (error.status === HttpStatus.CONFLICT) {
        throw new AdminException(AdminErrorStatus.DUPLICATE_LOCAL_DEPLOYMENT);
      }
      if (error.status === HttpStatus.UNPROCESSABLE_ENTITY) {
        throw new AdminException(
          AdminErrorStatus.INVALID_LOCAL_DEPLOYMENT_CONFIGURATION,
        );
      }
      throw new AdminException(
        AdminErrorStatus.LOCAL_DEPLOYMENT_PROVIDER_UNAVAILABLE,
      );
    }

    throw error;
  }

  private throwDeploymentStateUpdateError(error: unknown): never {
    if (error instanceof NerRequestException) {
      if (error.status === HttpStatus.NOT_FOUND) {
        throw new AdminException(AdminErrorStatus.LOCAL_DEPLOYMENT_NOT_FOUND);
      }
      if (error.status === HttpStatus.UNPROCESSABLE_ENTITY) {
        throw new AdminException(
          AdminErrorStatus.INVALID_LOCAL_DEPLOYMENT_CONFIGURATION,
        );
      }
      throw new AdminException(
        AdminErrorStatus.LOCAL_DEPLOYMENT_PROVIDER_UNAVAILABLE,
      );
    }

    throw error;
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

  private assertTotalAdministrator(
    authentication: Readonly<AuthenticatedUser>,
  ): void {
    if (authentication.role !== UserRole.TOTAL_ADMIN) {
      throw new SecurityException(SecurityErrorStatus.FORBIDDEN);
    }
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
        return '총 관리자';
    }
  }

  private normalizeUserListQuery(dto: AdminReqDTO.UserList): UserListQuery {
    const pageSize = Number(dto.pageSize);
    const pageNumber = this.toPageNumber(dto.pageNumber);
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

  private normalizeUserPromptOverviewQuery(
    dto: AdminReqDTO.UserPromptOverview,
  ): { pageSize: number; pageNumber: number; query: string } {
    const pageSize = Number(dto.pageSize);
    const pageNumber = this.toPageNumber(dto.pageNumber);
    const query = typeof dto.query === 'string' ? dto.query.trim() : '';
    if (
      !Number.isSafeInteger(pageSize)
      || pageSize < 1
      || pageSize > MAX_USER_LIST_PAGE_SIZE
      || !Number.isSafeInteger(pageNumber)
      || pageNumber < 1
      || query.length === 0
      || query.length > MAX_DEPARTMENT_NAME_LENGTH
    ) {
      throw new AdminException(AdminErrorStatus.INVALID_USER_LIST_QUERY);
    }
    return { pageSize, pageNumber, query };
  }

  private normalizeUserPromptListQuery(
    dto: AdminReqDTO.UserPromptList,
  ): { pageSize: number; pageNumber: number } {
    const pageSize = Number(dto.pageSize);
    const pageNumber = this.toPageNumber(dto.pageNumber);
    if (
      !Number.isSafeInteger(pageSize)
      || pageSize < 1
      || pageSize > MAX_USER_LIST_PAGE_SIZE
      || !Number.isSafeInteger(pageNumber)
      || pageNumber < 1
    ) {
      throw new AdminException(AdminErrorStatus.INVALID_USER_LIST_QUERY);
    }
    return { pageSize, pageNumber };
  }

  private normalizeDepartmentListQuery(
    dto: AdminReqDTO.DepartmentList,
  ): DepartmentListQuery {
    const pageSize = Number(dto.pageSize);
    const pageNumber = this.toPageNumber(dto.pageNumber);
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

  /** HTTP 클라이언트가 첫 페이지를 `null` 문자열로 보내는 경우를 허용합니다. */
  private toPageNumber(value: unknown): number {
    if (
      value === null
      || (typeof value === 'string' && value.trim().toLowerCase() === 'null')
    ) {
      return INITIAL_PAGE_NUMBER;
    }

    return Number(value);
  }

  private toDepartmentRiskSince(recent: string, now: Date): Date {
    const daysByRecent: Record<string, number> = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
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
    return toKoreaStandardTimeDateString(value);
  }

  private toDateTimeString(value: Date | string): string {
    return toKoreaStandardTimeISOString(value);
  }

  private toMemberLimitTotals(
    memberLimits: readonly Readonly<Pick<MemberLimitDAO, 'limit' | 'usage'>>[],
  ): { limit: number; usage: number } {
    let totalLimit = 0n;
    let totalUsage = 0n;
    let hasUnlimitedLimit = false;

    for (const memberLimit of memberLimits) {
      const limit = BigInt(memberLimit.limit);
      totalUsage += BigInt(Math.round(Number(memberLimit.usage) * 1_000_000));
      if (limit === 0n) {
        hasUnlimitedLimit = true;
      } else {
        totalLimit += limit;
      }
    }

    return {
      limit: hasUnlimitedLimit ? 0 : Number(totalLimit),
      usage: Number(totalUsage) / 1_000_000,
    };
  }

  /** 마스킹 상세의 원문 위치를 뒤에서부터 치환해 최종 전송문을 복원합니다. */
  private toMaskedPromptText(
    originalText: string,
    detections: readonly Readonly<AdminResDTO.PromptDetection>[],
  ): string {
    let maskedText = originalText;
    const descendingDetections = [...detections].sort(
      (left, right) => right.startIdx - left.startIdx,
    );

    for (const detection of descendingDetections) {
      const endExclusive = detection.endIdx + 1;
      if (
        detection.startIdx < 0
        || endExclusive > originalText.length
        || originalText.slice(detection.startIdx, endExclusive)
          !== detection.targetText
      ) {
        continue;
      }
      maskedText = maskedText.slice(0, detection.startIdx)
        + detection.maskingText
        + maskedText.slice(endExclusive);
    }

    return maskedText;
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

    const member = await this.memberRepository.findOneBy({
      memberId: String(userId),
    });
    if (member === null) {
      throw new AuthException(AuthErrorStatus.USER_NOT_FOUND);
    }

    if (authentication.role === UserRole.DEPART_ADMIN) {
      const membership = await this.memberDepartmentRepository.findOne({
        select: { departmentId: true },
        where: { memberId: String(userId) },
      });
      if (membership === null) {
        throw new AuthException(AuthErrorStatus.USER_NOT_FOUND);
      }
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
