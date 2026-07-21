import { Injectable } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { AdminReqDTO } from '../dto/admin.request.dto.js';
import { AdminResDTO } from '../dto/admin.response.dto.js';
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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_PROFILE_URL = '';

@Injectable()
export class AdminService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly passwordEncoder: PasswordEncoderService,
    private readonly userMapper: UserMapper,
  ) {}

  async createUser(
    dto: AdminReqDTO.CreateUser,
    authentication: AuthenticatedUser,
  ): Promise<AdminResDTO.CreateUser> {
    return this.dataSource.transaction(async (manager) => {
      const departmentRepository = manager.getRepository(DepartmentDAO);
      const memberRepository = manager.getRepository(MemberDAO);
      const memberDepartmentRepository = manager.getRepository(MemberDepartmentDAO);

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
          memberId: savedMember.memberId,
          departmentId: department.departmentId,
        });

        await memberDepartmentRepository.save(memberDepartment);

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
    return AdminMapper.toCreateDepartment({
      name: dto.name,
      createdAt: '',
    });
  }

  async getDepartments(
    dto: AdminReqDTO.DepartmentList,
  ): Promise<AdminResDTO.DepartmentList> {
    return AdminMapper.toDepartmentList({
      data: [],
      totalCnt: 0,
      pageNumber: dto.pageNumber,
    });
  }

  async registerApiKey(
    departmentId: number,
    dto: AdminReqDTO.RegisterApiKey,
  ): Promise<AdminResDTO.RegisterApiKey> {
    void departmentId;
    return AdminMapper.toRegisterApiKey({
      targetDepartment: '',
      service: dto.service,
      createdAt: '',
    });
  }

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
    return AdminMapper.toUserList({
      data: [],
      totalCnt: 0,
      filteringCnt: null,
      pageNumber: 1,
    });
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
    return role === UserRole.USER ? '일반 사용자' : '부서 관리자';
  }

  private isDuplicateEntry(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const driverError = error.driverError as { code?: string; errno?: number };
    return driverError.code === 'ER_DUP_ENTRY' || driverError.errno === 1062;
  }
}
