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
  Put,
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
  CreateDepartmentDocs,
  CreateUserDocs,
  DashboardDocs,
  DepartmentDetailDocs,
  DepartmentListDocs,
  DepartmentManagementSummaryDocs,
  DepartmentRolesDocs,
  DepartmentRisksDocs,
  DisableUserDocs,
  LogDetailDocs,
  LogListDocs,
  LogsSummaryDocs,
  PolicyDetectDocs,
  PromptDetailDocs,
  RegisterApiKeyDocs,
  SyncPoliciesDocs,
  RestoreUserDocs,
  TrendsDocs,
  UpdateUserDocs,
  UserDetailDocs,
  UserListDocs,
  UserPromptListDocs,
  UserPromptOverviewDocs,
  UserSummaryDocs,
} from './docs/admin.controller.docs.js';
import { Roles } from '../../../global/security/decorator/roles.decorator.js';
import { UserRole } from '../../../global/security/type/user-role.enum.js';
import { CurrentUser } from '../../../global/security/decorator/current-user.decorator.js';
import type { AuthenticatedUser } from '../../../global/security/type/jwt-payload.type.js';
import { UserSuccessStatus } from '../../user/code/user.status.js';
import { UserResDTO } from '../../user/dto/user.response.dto.js';
import { DepartmentPolicyListDocs } from '../../user/controller/docs/user.controller.docs.js';

@AdminControllerDocs()
@Roles(UserRole.DEPART_ADMIN, UserRole.TOTAL_ADMIN)
@Controller()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @CreateUserDocs()
  @Post('/admin/v1/users')
  @HttpCode(HttpStatus.CREATED)
  async createUser(
    @Body() dto: AdminReqDTO.CreateUser,
    @CurrentUser() authentication: AuthenticatedUser,
  ): Promise<GeneralResponse<AdminResDTO.CreateUser>> {
    const result = await this.adminService.createUser(dto, authentication);
    return GeneralResponse.onSuccess(AdminSuccessStatus.CREATE_USER, result);
  }

  @CreateDepartmentDocs()
  @Roles(UserRole.TOTAL_ADMIN)
  @Post('/admin/v1/departments')
  @HttpCode(HttpStatus.CREATED)
  async createDepartment(
    @Body() dto: AdminReqDTO.CreateDepartment,
  ): Promise<GeneralResponse<AdminResDTO.CreateDepartment>> {
    const result = await this.adminService.createDepartment(dto);
    return GeneralResponse.onSuccess(
      AdminSuccessStatus.CREATE_DEPARTMENT,
      result,
    );
  }

  @DepartmentListDocs()
  @Get('/admin/v1/departments')
  async getDepartmentList(
    @Query() dto: AdminReqDTO.DepartmentList,
  ): Promise<GeneralResponse<AdminResDTO.DepartmentList | null>> {
    const result = await this.adminService.getDepartments(dto);
    return GeneralResponse.onSuccess(
      AdminSuccessStatus.DEPARTMENT_LIST,
      result,
    );
  }

  @DepartmentManagementSummaryDocs()
  @Get('/admin/v1/departments-summary')
  async getDepartmentManagementSummary(): Promise<
    GeneralResponse<AdminResDTO.DepartmentManagementSummary>
  > {
    const result = await this.adminService.getDepartmentManagementSummary();
    return GeneralResponse.onSuccess(
      AdminSuccessStatus.DEPARTMENT_SUMMARY,
      result,
    );
  }

  @DepartmentRolesDocs()
  @Get('/admin/v1/departments/:departmentId/roles')
  async getDepartmentRoles(
    @Param('departmentId', ParseIntPipe) departmentId: number,
  ): Promise<unknown> {
    return this.adminService.getDepartmentRoles(departmentId);
  }

  @DepartmentDetailDocs()
  @Get('/admin/v1/departments/:departmentId')
  async getDepartmentDetail(
    @Param('departmentId', ParseIntPipe) departmentId: number,
  ): Promise<GeneralResponse<AdminResDTO.DepartmentDetail>> {
    const result = await this.adminService.getDepartmentDetail(departmentId);
    return GeneralResponse.onSuccess(
      AdminSuccessStatus.DEPARTMENT_DETAIL,
      result,
    );
  }

  @RegisterApiKeyDocs()
  @Roles(UserRole.TOTAL_ADMIN)
  @Post('/admin/v1/departments/:departmentId/apis')
  @HttpCode(HttpStatus.CREATED)
  async validateAndRegisterLlmApiKey(
    @Param('departmentId', ParseIntPipe) departmentId: number,
    @Body() dto: AdminReqDTO.RegisterApiKey,
    @CurrentUser() authentication: AuthenticatedUser,
  ): Promise<GeneralResponse<AdminResDTO.RegisterApiKey>> {
    const result = await this.adminService.registerApiKey(
      departmentId,
      dto,
      authentication,
    );
    return GeneralResponse.onSuccess(
      AdminSuccessStatus.REGISTER_API_KEY,
      result,
    );
  }

  @SyncPoliciesDocs()
  @Roles(UserRole.TOTAL_ADMIN)
  @Put('/admin/v1/departments/:departmentId/policies')
  async syncDepartmentPolicies(
    @Param('departmentId', ParseIntPipe) departmentId: number,
    @Body() dto: AdminReqDTO.SyncPolicies,
    @CurrentUser() authentication: AuthenticatedUser,
  ): Promise<GeneralResponse<AdminResDTO.SyncPolicies>> {
    const result = await this.adminService.syncPolicies(
      departmentId,
      dto,
      authentication,
    );
    return GeneralResponse.onSuccess(
      AdminSuccessStatus.SYNC_POLICIES,
      result,
    );
  }

  @DepartmentPolicyListDocs()
  @Roles(UserRole.USER, UserRole.DEPART_ADMIN, UserRole.TOTAL_ADMIN)
  @Get('/api/v1/policies')
  async getDepartmentPolicyList(
    @CurrentUser() authentication: AuthenticatedUser,
  ): Promise<GeneralResponse<UserResDTO.PolicyList>> {
    const result = await this.adminService.getPolicies(authentication);
    return GeneralResponse.onSuccess(UserSuccessStatus.POLICY_LIST, result);
  }

  @DashboardDocs()
  @Get('/admin/v1/dashboard')
  async getOperationalStatus(): Promise<
    GeneralResponse<AdminResDTO.Dashboard>
  > {
    const result = await this.adminService.getDashboard();
    return GeneralResponse.onSuccess(AdminSuccessStatus.DASHBOARD, result);
  }

  @TrendsDocs()
  @Get('/admin/v1/trends')
  async getLlmUsageAndFilterDetectionTrends(
    @Query() dto: AdminReqDTO.Trends,
  ): Promise<GeneralResponse<AdminResDTO.Trends>> {
    const result = await this.adminService.getTrends(dto);
    return GeneralResponse.onSuccess(AdminSuccessStatus.TRENDS, result);
  }

  @AdminLogsDocs()
  @Get('/admin/v1/admin-logs')
  async getRecentAdminActivities(): Promise<
    GeneralResponse<AdminResDTO.AdminLogs>
  > {
    const result = await this.adminService.getAdminLogs();
    return GeneralResponse.onSuccess(AdminSuccessStatus.ADMIN_LOGS, result);
  }

  @PolicyDetectDocs()
  @Get('/admin/v1/policy-detect')
  async getPolicyDetectionCounts(): Promise<
    GeneralResponse<AdminResDTO.PolicyDetectList>
  > {
    const result = await this.adminService.getPolicyDetect();
    return GeneralResponse.onSuccess(AdminSuccessStatus.POLICY_DETECT, result);
  }

  @DepartmentRisksDocs()
  @Get('/admin/v1/department-risks')
  async getDepartmentRiskDistribution(
    @Query() dto: AdminReqDTO.DepartmentRisks,
  ): Promise<GeneralResponse<AdminResDTO.DepartmentRiskList>> {
    const result = await this.adminService.getDepartmentRisks(dto);
    return GeneralResponse.onSuccess(AdminSuccessStatus.DEPARTMENT_RISKS, result);
  }

  @UserSummaryDocs()
  @Get('/admin/v1/user-summary')
  async getUserAccountSummary(
    @CurrentUser() authentication: AuthenticatedUser,
  ): Promise<GeneralResponse<AdminResDTO.UserSummary>> {
    const result = await this.adminService.getUserSummary(authentication);
    return GeneralResponse.onSuccess(AdminSuccessStatus.USER_SUMMARY, result);
  }

  @UserListDocs()
  @Roles(UserRole.TOTAL_ADMIN)
  @Get('/admin/v1/users')
  async getUserAccountList(
    @Query() dto: AdminReqDTO.UserList,
    @CurrentUser() authentication: AuthenticatedUser,
  ): Promise<GeneralResponse<AdminResDTO.UserList>> {
    const result = await this.adminService.getUsers(dto, authentication);
    return GeneralResponse.onSuccess(AdminSuccessStatus.USER_LIST, result);
  }

  @UserDetailDocs()
  @Get('/admin/v1/users/:userId')
  async getUserAccountDetail(
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() authentication: AuthenticatedUser,
  ): Promise<GeneralResponse<AdminResDTO.UserDetail>> {
    const result = await this.adminService.getUserDetail(userId, authentication);
    return GeneralResponse.onSuccess(AdminSuccessStatus.USER_DETAIL, result);
  }

  @DisableUserDocs()
  @Delete('/admin/v1/users/:userId')
  async deactivateUserAccount(
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() authentication: AuthenticatedUser,
  ): Promise<GeneralResponse<AdminResDTO.DisableUser>> {
    const result = await this.adminService.disableUser(userId, authentication);
    return GeneralResponse.onSuccess(AdminSuccessStatus.DISABLE_USER, result);
  }

  @RestoreUserDocs()
  @Post('/admin/v1/users/:userId')
  @HttpCode(HttpStatus.OK)
  async restoreUserAccount(
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() authentication: AuthenticatedUser,
  ): Promise<GeneralResponse<AdminResDTO.RestoreUser>> {
    const result = await this.adminService.restoreUser(userId, authentication);
    return GeneralResponse.onSuccess(AdminSuccessStatus.RESTORE_USER, result);
  }

  @UpdateUserDocs()
  @Patch('/admin/v1/users/:userId')
  async updateUserInformation(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: Record<string, unknown>,
  ): Promise<GeneralResponse<AdminResDTO.UpdateUser>> {
    const result = await this.adminService.updateUser(userId, dto);
    return GeneralResponse.onSuccess(AdminSuccessStatus.UPDATE_USER, result);
  }

  @LogsSummaryDocs()
  @Get('/admin/v1/logs-summary')
  async getAllChatLogSummary(): Promise<
    GeneralResponse<AdminResDTO.LogsSummary>
  > {
    const result = await this.adminService.getLogsSummary();
    return GeneralResponse.onSuccess(AdminSuccessStatus.LOGS_SUMMARY, result);
  }

  @UserPromptOverviewDocs()
  @Get('/admin/v1/users-prompts')
  async getChatLogUserList(
    @Query() dto: AdminReqDTO.UserPromptOverview,
  ): Promise<GeneralResponse<AdminResDTO.UserPromptOverview>> {
    const result = await this.adminService.getUserPromptOverview(dto);
    return GeneralResponse.onSuccess(
      AdminSuccessStatus.USER_PROMPT_OVERVIEW,
      result,
    );
  }

  @UserPromptListDocs()
  @Get('/admin/v1/users/:userId/prompts')
  async getUserPromptList(
    @Param('userId', ParseIntPipe) userId: number,
    @Query() dto: AdminReqDTO.UserPromptList,
  ): Promise<GeneralResponse<AdminResDTO.UserPromptList>> {
    const result = await this.adminService.getUserPromptList(userId, dto);
    return GeneralResponse.onSuccess(
      AdminSuccessStatus.USER_PROMPT_LIST,
      result,
    );
  }

  @PromptDetailDocs()
  @Get('/admin/v1/prompts/:promptId')
  async getPromptDetail(
    @Param('promptId') promptId: string,
  ): Promise<GeneralResponse<AdminResDTO.PromptDetail>> {
    const result = await this.adminService.getPromptDetail(promptId);
    return GeneralResponse.onSuccess(AdminSuccessStatus.PROMPT_DETAIL, result);
  }

  @LogListDocs()
  @Get('/admin/v1/logs')
  async getLegacyLogList(
    @Query() dto: AdminReqDTO.LogList,
  ): Promise<GeneralResponse<AdminResDTO.LogList>> {
    const result = await this.adminService.getLogs(dto);
    return GeneralResponse.onSuccess(AdminSuccessStatus.LEGACY_LOG_LIST, result);
  }

  @LogDetailDocs()
  @Get('/admin/v1/logs/:logId')
  async getLegacyLogDetail(
    @Param('logId', ParseIntPipe) logId: number,
  ): Promise<GeneralResponse<AdminResDTO.LogDetail>> {
    const result = await this.adminService.getLogDetail(logId);
    return GeneralResponse.onSuccess(AdminSuccessStatus.LEGACY_LOG_DETAIL, result);
  }
}
