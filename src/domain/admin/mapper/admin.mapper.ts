import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminResDTO } from '../dto/admin.response.dto.js';
import { AdminData } from '../data/admin.data.js';
import { OffsetPageData } from '../../../global/data/offset-page.data.js';
import { ActiveApiKeyDAO } from '../dao/active-api-key.dao.js';
import { LOCAL_LLM_MODEL } from '../../../global/llm/llm-service.mapping.js';
import { AdminLogDAO } from '../dao/admin-log.dao.js';
import { DepartmentDAO } from '../dao/department.dao.js';
import {
  getMaskingCategoryDisplayName,
  getSecurityPolicyClassDisplayName,
  getSecurityPolicyDisplayName,
} from '../policy/security-policy.catalog.js';
import { toKoreaStandardTimeISOString } from '../../../global/time/korea-standard-time.js';

@Injectable()
export class AdminMapper {
  constructor(
    @InjectRepository(DepartmentDAO)
    private readonly departmentRepository: Repository<DepartmentDAO>,
    @InjectRepository(ActiveApiKeyDAO)
    private readonly activeApiKeyRepository: Repository<ActiveApiKeyDAO>,
    @InjectRepository(AdminLogDAO)
    private readonly adminLogRepository: Repository<AdminLogDAO>,
  ) {}

  toDepartmentDAO(data: Readonly<AdminData.CreateDepartment>): DepartmentDAO {
    return this.departmentRepository.create({
      departmentName: data.departmentName,
      departmentCode: data.departmentCode,
      mustFiltering: data.mustFiltering,
      limit: data.limit,
      usage: '0',
      recentUsePercent: '0',
    });
  }

  toActiveApiKeyDAO(
    data: Readonly<AdminData.CreateActiveApiKey>,
  ): ActiveApiKeyDAO {
    return this.activeApiKeyRepository.create({
      apiKey: data.apiKey,
      serviceType: data.serviceType,
      departmentId: data.departmentId,
    });
  }

  /** Local LLM은 외부 Provider API 키와 달리 별도 키 없이 부서별 권한만 둡니다. */
  toLocalLlmActiveApiKeyDAO(departmentId: string): ActiveApiKeyDAO {
    return this.activeApiKeyRepository.create({
      apiKey: null,
      serviceType: LOCAL_LLM_MODEL,
      departmentId,
    });
  }

  toAdminLogDAO(data: Readonly<AdminData.CreateAdminLog>): AdminLogDAO {
    return this.adminLogRepository.create({
      logContent: data.logContent,
      actionAt: data.actionAt,
      actionMemberName: data.actionMemberName,
    });
  }

  static toCreateUser(
    data: Readonly<AdminData.CreateUserResult>,
  ): AdminResDTO.CreateUser {
    return {
      id: Number(data.id),
      name: data.name,
    };
  }

  static toCreateDepartment(
    data: Readonly<AdminData.CreateDepartmentResult>,
  ): AdminResDTO.CreateDepartment {
    return {
      departmentId: Number(data.departmentId),
      departmentName: data.departmentName,
      createdAt: this.toDateTimeString(data.createdAt),
    };
  }

  static toDepartmentListItem(
    data: Readonly<AdminData.DepartmentListItem>,
  ): AdminResDTO.DepartmentListItem {
    return {
      departmentId: data.departmentId,
      departmentName: data.departmentName,
      departmentUserCnt: data.departmentUserCnt,
      canUseLLMModel: [...data.canUseLLMModel],
      policyType: data.policyType,
      policyCnt: data.policyCnt,
      outbound: data.outbound,
      departLimitPercent: data.departLimitPercent,
      departLimitUsd: data.departLimitUsd,
      departUseUsd: data.departUseUsd,
    };
  }

  static toDepartmentList(
    page: Readonly<AdminData.DepartmentList>,
  ): AdminResDTO.DepartmentList {
    const data = page.data.map((item) => this.toDepartmentListItem(item));

    return {
      data,
      totalCnt: page.totalCnt,
      dataCnt: data.length,
      pageNumber: page.pageNumber,
    };
  }

  static toDepartmentManagementSummary(
    data: Readonly<AdminData.DepartmentManagementSummary>,
  ): AdminResDTO.DepartmentManagementSummary {
    return {
      updatedAt: this.toDateTimeString(data.updatedAt),
      totalDepartmentCnt: data.totalDepartmentCnt,
      totalUserCnt: data.totalUserCnt,
      outboundDepartmentCnt: data.outboundDepartmentCnt,
      averageUsePercent: data.averageUsePercent,
      averageRate: data.averageRate,
    };
  }

  static toRegisterApiKey(
    data: Readonly<AdminData.RegisterApiKeyResult>,
  ): AdminResDTO.RegisterApiKey {
    return {
      targetDepartment: data.targetDepartment,
      service: data.service,
      createdAt: this.toDateTimeString(data.createdAt),
    };
  }

  static toPolicy(data: Readonly<AdminData.PolicyResult>): AdminResDTO.Policy {
    return {
      policyId: Number(data.policyId),
      targetDepartment: data.targetDepartment,
      maskingContent: getSecurityPolicyDisplayName(data.maskingContent),
      maskingClass: getSecurityPolicyClassDisplayName(data.maskingClass),
      changedAt: this.toDateTimeString(data.changedAt),
    };
  }

  static toPolicyList(
    targetDepartment: string,
    policies: readonly Readonly<AdminData.PolicyListItem>[],
  ): AdminResDTO.PolicyList {
    return {
      targetDepartment,
      policies: policies.map((policy) => ({
        policyId: Number(policy.policyId),
        maskingContent: getSecurityPolicyDisplayName(policy.maskingContent),
        maskingClass: getSecurityPolicyClassDisplayName(policy.maskingClass),
      })),
      totalCnt: policies.length,
    };
  }

  static toPolicyPresetList(
    presets: readonly Readonly<{
      name: string | null;
      isActive: boolean;
      presetPolicies?: readonly Readonly<{
        policy: Readonly<{ maskingContent: string }>;
      }>[];
    }>[],
  ): AdminResDTO.PolicyPreset[] {
    return presets.map((preset) => ({
      presetName: preset.name ?? '',
      isActive: preset.isActive,
      policies: (preset.presetPolicies ?? []).map(({ policy }) =>
        getSecurityPolicyDisplayName(policy.maskingContent)),
    }));
  }

  static toSyncPolicies(
    targetDepartment: string,
    policies: readonly Readonly<AdminData.PolicyListItem>[],
  ): AdminResDTO.SyncPolicies {
    return {
      targetDepartment,
      policies: policies.map((policy) =>
        getSecurityPolicyDisplayName(policy.maskingContent)),
    };
  }

  static toDashboard(data: Readonly<AdminResDTO.Dashboard>): AdminResDTO.Dashboard {
    return { ...data };
  }

  static toAdminLog(
    title: string,
    activityAt: string,
    adminName: string,
  ): AdminResDTO.AdminLog {
    return { title, activityAt, adminName };
  }

  static toPolicyDetect(
    category: string,
    detailCategory: string,
    count: number,
  ): AdminResDTO.PolicyDetect {
    return {
      category: getMaskingCategoryDisplayName(category),
      detailCategory: getSecurityPolicyDisplayName(detailCategory),
      count,
    };
  }

  static toDepartmentRisk(
    departmentName: string,
    llmRequestCnt: number,
    userCnt: number,
    detectRate: number,
  ): AdminResDTO.DepartmentRisk {
    return { departmentName, llmRequestCnt, userCnt, detectRate };
  }

  static toUserSummary(
    updatedAt: string,
    totalUserCnt: number,
    activateUserCnt: number,
    disabledUserCnt: number,
    newUserCnt: number,
  ): AdminResDTO.UserSummary {
    return {
      updatedAt,
      totalUserCnt,
      activateUserCnt,
      disabledUserCnt,
      newUserCnt,
    };
  }

  static toUserListItem(
    data: Readonly<AdminData.UserListItem>,
  ): AdminResDTO.UserListItem {
    return {
      userId: data.userId,
      name: data.name,
      email: data.email,
      department: data.department,
      authorize: data.authorize,
      status: data.status,
    };
  }

  static toUserList(
    page: Readonly<OffsetPageData<AdminData.UserListItem>>,
  ): AdminResDTO.UserList {
    const data = page.data.map((item) => this.toUserListItem(item));

    return {
      data,
      totalCnt: page.totalCnt,
      dataCnt: data.length,
      filteringCnt: page.filteringCnt,
      pageNumber: page.pageNumber,
    };
  }

  static toUserDetail(data: Readonly<AdminResDTO.UserDetail>): AdminResDTO.UserDetail {
    return { ...data };
  }

  static toDepartmentDetail(
    data: Readonly<AdminResDTO.DepartmentDetail>,
  ): AdminResDTO.DepartmentDetail {
    return {
      ...data,
      llmModel: data.llmModel.map((model) => ({ ...model })),
      policies: data.policies === null
        ? null
        : data.policies.map((policy) => ({ ...policy })),
    };
  }

  static toDisableUser(name: string, disabledAt: string): AdminResDTO.DisableUser {
    return { name, disabledAt };
  }

  static toRestoreUser(name: string, restoredAt: string): AdminResDTO.RestoreUser {
    return { name, restoredAt };
  }

  static toLogsSummary(
    updatedAt: string,
    totalChatCnt: number,
    filterDetectCnt: number,
    masking: number,
    local: number,
    localRate: number,
  ): AdminResDTO.LogsSummary {
    return {
      updatedAt,
      totalChatCnt,
      filterDetectCnt,
      masking,
      local,
      localRate,
    };
  }

  static toUnknown<T>(result: T): T {
    return result;
  }

  private static toDateTimeString(value: Date | string): string {
    return toKoreaStandardTimeISOString(value);
  }
}
