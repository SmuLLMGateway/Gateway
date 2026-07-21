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
  }

  export interface DepartmentList {
    data: readonly DepartmentListItem[];
    totalCnt: number;
    pageNumber: number;
  }

  export interface RegisterApiKeyResult {
    targetDepartment: string;
    service: string;
    createdAt: Date | string;
  }

  export interface CreateDepartment {
    departmentName: string;
  }

  export interface CreateActiveApiKey {
    apiKey: string;
    serviceType: string;
    departmentLimit: string;
    departmentId: string;
  }

  export interface CreatePolicy {
    maskingContent: string;
    maskingClass: MaskingClass;
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
    department: string;
    role: string;
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
