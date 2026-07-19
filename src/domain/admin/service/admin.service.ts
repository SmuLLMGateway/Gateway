import { Injectable } from '@nestjs/common';
import { AdminReqDTO } from '../dto/admin.request.dto.js';
import { AdminResDTO } from '../dto/admin.response.dto.js';

@Injectable()
export class AdminService {
  async getDashboard(): Promise<AdminResDTO.Dashboard> {
    return {
      updatedAt: '', userCnt: 0, userRate: 0, chatCnt: 0, chatRate: 0,
      filterDetect: 0, filterDetectRate: 0, maskingToGpt: 0,
      maskingToClaude: 0, maskingToGemini: 0, totalGpt: 0,
      totalClaude: 0, totalGemini: 0, local: 0, localRate: 0,
    };
  }

  async getTrends(dto: AdminReqDTO.Trends): Promise<AdminResDTO.Trends> {
    void dto;
    return null;
  }

  async getAdminLogs(): Promise<AdminResDTO.AdminLogs> { return []; }
  async getPolicyDetect(): Promise<AdminResDTO.PolicyDetectList> { return []; }

  async getDepartmentRisks(
    dto: AdminReqDTO.DepartmentRisks,
  ): Promise<AdminResDTO.DepartmentRiskList> {
    void dto;
    return [];
  }

  async getUserSummary(): Promise<AdminResDTO.UserSummary> {
    return {
      updatedAt: '', totalUserCnt: 0, activateUserCnt: 0,
      disabledUserCnt: 0, newUserCnt: 0,
    };
  }

  async getUsers(dto: AdminReqDTO.UserList): Promise<AdminResDTO.UserList> {
    void dto;
    return { data: [], totalCnt: 0, dataCnt: 0, filteringCnt: null, pageNumber: 1 };
  }

  async getUserDetail(userId: number): Promise<AdminResDTO.UserDetail> {
    void userId;
    return {
      name: '', email: '', department: '', role: '', createdAt: '', createdBy: '',
      lastLoginAt: '', chatCnt: 0, filterDetectCnt: 0, masking: 0, local: 0,
    };
  }

  async disableUser(userId: number): Promise<AdminResDTO.DisableUser> {
    void userId;
    return { name: '', disabledAt: '' };
  }

  async restoreUser(userId: number): Promise<AdminResDTO.RestoreUser> {
    void userId;
    return { name: '', restoredAt: '' };
  }

  async updateUser(userId: number, dto: unknown): Promise<AdminResDTO.UpdateUser> {
    void userId;
    void dto;
    return null;
  }

  async getLogsSummary(): Promise<AdminResDTO.LogsSummary> {
    return { updatedAt: '', totalChatCnt: 0, filterDetectCnt: 0, masking: 0, local: 0 };
  }

  async getLogs(dto: AdminReqDTO.LogList): Promise<AdminResDTO.LogList> {
    void dto;
    return { data: [], totalCnt: 0, dataCnt: 0, filteringCnt: null, pageNumber: 1 };
  }

  async getLogDetail(logId: number): Promise<AdminResDTO.LogDetail> {
    void logId;
    return null;
  }
}
