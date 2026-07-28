import type { MaskingClass } from '../dao/policy.dao.js';

export namespace AdminData {
  export interface CreateUserResult {
    name: string;
    role: string;
    createdAt: Date | string;
  }

  export interface CreateDepartmentResult {
    name: string;
    createdAt: Date | string;
  }

  export interface DepartmentListItem {
    departmentId: number;
    departmentName: string;
    departmentUserCnt: number;
    canUseLLMModel: string[] | null;
    policyType: '표준' | '커스텀';
    policyCnt: number;
    outbound: '허용' | '불가';
    departLimitPercent: number;
    departLimitUsd: number;
    departUseUsd: number;
  }

  export interface DepartmentList {
    data: readonly DepartmentListItem[];
    totalCnt: number;
    pageNumber: number;
  }

  export interface DepartmentManagementSummary {
    updatedAt: Date | string;
    totalDepartmentCnt: number;
    totalUserCnt: number;
    outboundDepartmentCnt: number;
    averageUsePercent: number;
    averageRate: number;
  }

  export interface RegisterApiKeyResult {
    targetDepartment: string;
    service: string;
    createdAt: Date | string;
  }

  export interface PolicyResult {
    policyId: string;
    targetDepartment: string;
    maskingContent: string;
    maskingClass: MaskingClass;
    changedAt: Date | string;
  }

  export interface PolicyListItem {
    policyId: string;
    maskingContent: string;
    maskingClass: MaskingClass;
  }

  export interface CreateDepartment {
    departmentName: string;
  }

  export interface CreateActiveApiKey {
    apiKey: string;
    serviceType: string;
    limit: string;
    usage: string;
    departmentId: string;
  }

  export interface CreateAdminLog {
    logContent: string;
    actionAt: Date;
    actionMemberName: string;
  }

  /** 사용자 계정 목록 조회 결과의 원본 데이터 */
  export interface UserListItem {
    userId: number;
    name: string;
    email: string;
    department: string | null;
    authorize: string;
    lastLoginAt: Date | string;
    status: string;
  }

  export interface Detecting {
    sensitiveCnt: number;
    privateCnt: number;
  }

  /** 이용 기록 목록 조회 결과의 원본 데이터 */
  export interface LogListItem {
    logId: number;
    title: string;
    userDepartment: string;
    chatStartedAt: Date | string;
    chatEndedAt: Date | string;
    model: string;
    detecting: Detecting | null;
    process: string;
  }
}
