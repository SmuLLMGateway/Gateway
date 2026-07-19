import { Injectable } from '@nestjs/common';
import { AdminReqDTO } from '../dto/admin.request.dto.js';
import { AdminResDTO } from '../dto/admin.response.dto.js';
import { AdminMapper } from '../mapper/admin.mapper.js';

@Injectable()
export class AdminService {
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

  async getUserSummary(): Promise<AdminResDTO.UserSummary> {
    return AdminMapper.toUserSummary('', 0, 0, 0, 0);
  }

  async getUsers(dto: AdminReqDTO.UserList): Promise<AdminResDTO.UserList> {
    void dto;
    return AdminMapper.toUserList([], 0, 0, null, 1);
  }

  async getUserDetail(userId: number): Promise<AdminResDTO.UserDetail> {
    void userId;
    return AdminMapper.toUserDetail({
      name: '', email: '', department: '', role: '', createdAt: '', createdBy: '',
      lastLoginAt: '', chatCnt: 0, filterDetectCnt: 0, masking: 0, local: 0,
    });
  }

  async disableUser(userId: number): Promise<AdminResDTO.DisableUser> {
    void userId;
    return AdminMapper.toDisableUser('', '');
  }

  async restoreUser(userId: number): Promise<AdminResDTO.RestoreUser> {
    void userId;
    return AdminMapper.toRestoreUser('', '');
  }

  async updateUser(userId: number, dto: unknown): Promise<AdminResDTO.UpdateUser> {
    void userId;
    void dto;
    return AdminMapper.toUnknown(null);
  }

  async getLogsSummary(): Promise<AdminResDTO.LogsSummary> {
    return AdminMapper.toLogsSummary('', 0, 0, 0, 0);
  }

  async getLogs(dto: AdminReqDTO.LogList): Promise<AdminResDTO.LogList> {
    void dto;
    return AdminMapper.toLogList([], 0, 0, null, 1);
  }

  async getLogDetail(logId: number): Promise<AdminResDTO.LogDetail> {
    void logId;
    return AdminMapper.toUnknown(null);
  }
}
