import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminResDTO } from '../dto/admin.response.dto.js';
import { AdminData } from '../data/admin.data.js';
import { OffsetPageData } from '../../../global/data/offset-page.data.js';
import { ActiveApiKeyDAO } from '../dao/active-api-key.dao.js';
import { AdminLogDAO } from '../dao/admin-log.dao.js';
import { DepartmentDAO } from '../dao/department.dao.js';
import { PolicyDAO } from '../dao/policy.dao.js';

@Injectable()
export class AdminMapper {
  constructor(
    @InjectRepository(DepartmentDAO)
    private readonly departmentRepository: Repository<DepartmentDAO>,
    @InjectRepository(ActiveApiKeyDAO)
    private readonly activeApiKeyRepository: Repository<ActiveApiKeyDAO>,
    @InjectRepository(PolicyDAO)
    private readonly policyRepository: Repository<PolicyDAO>,
    @InjectRepository(AdminLogDAO)
    private readonly adminLogRepository: Repository<AdminLogDAO>,
  ) {}

  toDepartmentDAO(data: Readonly<AdminData.CreateDepartment>): DepartmentDAO {
    return this.departmentRepository.create({
      departmentName: data.departmentName,
    });
  }

  toActiveApiKeyDAO(
    data: Readonly<AdminData.CreateActiveApiKey>,
  ): ActiveApiKeyDAO {
    return this.activeApiKeyRepository.create({
      apiKey: data.apiKey,
      serviceType: data.serviceType,
      departmentLimit: data.departmentLimit,
      departmentId: data.departmentId,
    });
  }

  toPolicyDAO(data: Readonly<AdminData.CreatePolicy>): PolicyDAO {
    return this.policyRepository.create({
      maskingContent: data.maskingContent,
      maskingClass: data.maskingClass,
      departmentId: data.departmentId,
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
      name: data.name,
      role: data.role,
      createdAt: this.toDateTimeString(data.createdAt),
    };
  }

  static toCreateDepartment(
    data: Readonly<AdminData.CreateDepartmentResult>,
  ): AdminResDTO.CreateDepartment {
    return {
      name: data.name,
      createdAt: this.toDateTimeString(data.createdAt),
    };
  }

  static toDepartmentListItem(
    data: Readonly<AdminData.DepartmentListItem>,
  ): AdminResDTO.DepartmentListItem {
    return {
      departmentId: data.departmentId,
      departmentName: data.departmentName,
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

  static toRegisterApiKey(
    data: Readonly<AdminData.RegisterApiKeyResult>,
  ): AdminResDTO.RegisterApiKey {
    return {
      targetDepartment: data.targetDepartment,
      service: data.service,
      createdAt: this.toDateTimeString(data.createdAt),
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
    return { category, detailCategory, count };
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
      role: data.role,
      lastLoginAt: this.toDateTimeString(data.lastLoginAt),
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
  ): AdminResDTO.LogsSummary {
    return { updatedAt, totalChatCnt, filterDetectCnt, masking, local };
  }

  static toDetecting(data: Readonly<AdminData.Detecting>): AdminResDTO.Detecting {
    return {
      sensitiveCnt: data.sensitiveCnt,
      privateCnt: data.privateCnt,
    };
  }

  static toLogListItem(
    data: Readonly<AdminData.LogListItem>,
  ): AdminResDTO.LogListItem {
    return {
      logId: data.logId,
      title: data.title,
      userDepartment: data.userDepartment,
      chatStartedAt: this.toDateTimeString(data.chatStartedAt),
      chatEndedAt: this.toDateTimeString(data.chatEndedAt),
      model: data.model,
      detecting: data.detecting ? this.toDetecting(data.detecting) : null,
      process: data.process,
    };
  }

  static toLogList(
    page: Readonly<OffsetPageData<AdminData.LogListItem>>,
  ): AdminResDTO.LogList {
    const data = page.data.map((item) => this.toLogListItem(item));

    return {
      data,
      totalCnt: page.totalCnt,
      dataCnt: data.length,
      filteringCnt: page.filteringCnt,
      pageNumber: page.pageNumber,
    };
  }

  static toUnknown<T>(result: T): T {
    return result;
  }

  private static toDateTimeString(value: Date | string): string {
    return value instanceof Date ? value.toISOString() : value;
  }
}
