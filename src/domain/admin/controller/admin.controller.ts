import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { GeneralResponse } from '../../../global/apiPayload/general.response.js';
import { AdminSuccessStatus } from '../code/admin.status.js';
import { AdminReqDTO } from '../dto/admin.request.dto.js';
import { AdminResDTO } from '../dto/admin.response.dto.js';
import { AdminService } from '../service/admin.service.js';
import {
  AdminControllerDocs,
  AdminLogsDocs,
  DashboardDocs,
  DepartmentRisksDocs,
  DisableUserDocs,
  LogDetailDocs,
  LogListDocs,
  LogsSummaryDocs,
  PolicyDetectDocs,
  RestoreUserDocs,
  TrendsDocs,
  UpdateUserDocs,
  UserDetailDocs,
  UserListDocs,
  UserSummaryDocs,
} from './docs/admin.controller.docs.js';

@AdminControllerDocs()
@Controller()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @DashboardDocs()
  @Get('/admin/v1/dashboard')
  async getDashboard(): Promise<GeneralResponse<AdminResDTO.Dashboard>> {
    const result = await this.adminService.getDashboard();
    return GeneralResponse.onSuccess(AdminSuccessStatus.DASHBOARD, result);
  }

  @TrendsDocs()
  @Get('/admin/v1/trends')
  async getTrends(
    @Query() dto: AdminReqDTO.Trends,
  ): Promise<GeneralResponse<AdminResDTO.Trends>> {
    const result = await this.adminService.getTrends(dto);
    return GeneralResponse.onSuccess(AdminSuccessStatus.TRENDS, result);
  }

  @AdminLogsDocs()
  @Get('/admin/v1/admin-logs')
  async getAdminLogs(): Promise<GeneralResponse<AdminResDTO.AdminLogs>> {
    const result = await this.adminService.getAdminLogs();
    return GeneralResponse.onSuccess(AdminSuccessStatus.ADMIN_LOGS, result);
  }

  @PolicyDetectDocs()
  @Get('/admin/v1/policy-detect')
  async getPolicyDetect(): Promise<GeneralResponse<AdminResDTO.PolicyDetectList>> {
    const result = await this.adminService.getPolicyDetect();
    return GeneralResponse.onSuccess(AdminSuccessStatus.POLICY_DETECT, result);
  }

  @DepartmentRisksDocs()
  @Get('/admin/v1/department-risks')
  async getDepartmentRisks(
    @Query() dto: AdminReqDTO.DepartmentRisks,
  ): Promise<GeneralResponse<AdminResDTO.DepartmentRiskList>> {
    const result = await this.adminService.getDepartmentRisks(dto);
    return GeneralResponse.onSuccess(AdminSuccessStatus.DEPARTMENT_RISKS, result);
  }

  @UserSummaryDocs()
  @Get('/admin/v1/user-summary')
  async getUserSummary(): Promise<GeneralResponse<AdminResDTO.UserSummary>> {
    const result = await this.adminService.getUserSummary();
    return GeneralResponse.onSuccess(AdminSuccessStatus.USER_SUMMARY, result);
  }

  @UserListDocs()
  @Get('/admin/v1/users')
  async getUsers(
    @Query() dto: AdminReqDTO.UserList,
  ): Promise<GeneralResponse<AdminResDTO.UserList>> {
    const result = await this.adminService.getUsers(dto);
    return GeneralResponse.onSuccess(AdminSuccessStatus.USER_LIST, result);
  }

  @UserDetailDocs()
  @Get('/admin/v1/users/:userId')
  async getUserDetail(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<GeneralResponse<AdminResDTO.UserDetail>> {
    const result = await this.adminService.getUserDetail(userId);
    return GeneralResponse.onSuccess(AdminSuccessStatus.USER_DETAIL, result);
  }

  @DisableUserDocs()
  @Delete('/admin/v1/users/:userId')
  async disableUser(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<GeneralResponse<AdminResDTO.DisableUser>> {
    const result = await this.adminService.disableUser(userId);
    return GeneralResponse.onSuccess(AdminSuccessStatus.DISABLE_USER, result);
  }

  @RestoreUserDocs()
  @Post('/admin/v1/users/:userId')
  @HttpCode(HttpStatus.OK)
  async restoreUser(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<GeneralResponse<AdminResDTO.RestoreUser>> {
    const result = await this.adminService.restoreUser(userId);
    return GeneralResponse.onSuccess(AdminSuccessStatus.RESTORE_USER, result);
  }

  @UpdateUserDocs()
  @Patch('/admin/v1/users/:userId')
  async updateUser(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: Record<string, unknown>,
  ): Promise<GeneralResponse<AdminResDTO.UpdateUser>> {
    const result = await this.adminService.updateUser(userId, dto);
    return GeneralResponse.onSuccess(AdminSuccessStatus.UPDATE_USER, result);
  }

  @LogsSummaryDocs()
  @Get('/admin/v1/logs-summary')
  async getLogsSummary(): Promise<GeneralResponse<AdminResDTO.LogsSummary>> {
    const result = await this.adminService.getLogsSummary();
    return GeneralResponse.onSuccess(AdminSuccessStatus.LOGS_SUMMARY, result);
  }

  @LogListDocs()
  @Get('/admin/v1/logs')
  async getLogs(
    @Query() dto: AdminReqDTO.LogList,
  ): Promise<GeneralResponse<AdminResDTO.LogList>> {
    const result = await this.adminService.getLogs(dto);
    return GeneralResponse.onSuccess(AdminSuccessStatus.LOG_LIST, result);
  }

  @LogDetailDocs()
  @Get('/admin/v1/logs/:logId')
  async getLogDetail(
    @Param('logId', ParseIntPipe) logId: number,
  ): Promise<GeneralResponse<AdminResDTO.LogDetail>> {
    const result = await this.adminService.getLogDetail(logId);
    return GeneralResponse.onSuccess(AdminSuccessStatus.LOG_DETAIL, result);
  }
}
