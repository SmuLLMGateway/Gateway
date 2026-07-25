import { Injectable } from '@nestjs/common';
import { UserReqDTO } from '../dto/user.request.dto.js';
import { UserResDTO } from '../dto/user.response.dto.js';
import { UserMapper } from '../mapper/user.mapper.js';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MemberDAO } from '../dao/member.dao.js';
import { MemberDepartmentDAO } from '../dao/member-department.dao.js';
import { DepartmentDAO } from '../../admin/dao/department.dao.js';
import type { AuthenticatedUser } from '../../../global/security/type/jwt-payload.type.js';
import { AuthException } from '../../auth/exception/auth.exception.js';
import { AuthErrorStatus } from '../../auth/code/auth.status.js';
import { UserRole } from '../../../global/security/type/user-role.enum.js';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(MemberDAO)
    private readonly memberRepository: Repository<MemberDAO>,
    @InjectRepository(MemberDepartmentDAO)
    private readonly memberDepartmentRepository: Repository<MemberDepartmentDAO>,
    @InjectRepository(DepartmentDAO)
    private readonly departmentRepository: Repository<DepartmentDAO>,
  ) {}

  async getUserInfo(
    authentication: Readonly<AuthenticatedUser>,
  ): Promise<UserResDTO.UserInfo> {
    const member = await this.memberRepository.findOneBy({
      memberId: String(authentication.userId),
    });
    const membership = await this.memberDepartmentRepository.findOne({
      select: { departmentId: true },
      where: { memberId: String(authentication.userId) },
    });
    if (member === null || membership === null) {
      throw new AuthException(AuthErrorStatus.USER_NOT_FOUND);
    }

    const department = await this.departmentRepository.findOneBy({
      departmentId: membership.departmentId,
    });
    if (department === null) {
      throw new AuthException(AuthErrorStatus.USER_NOT_FOUND);
    }

    return {
      email: member.email,
      name: member.memberName,
      department: department.departmentName,
      role: this.toRoleName(member.authorize),
    };
  }

  async getMessageSummary(): Promise<UserResDTO.MessageSummary> {
    return UserMapper.toMessageSummary('', 0, 0, 0, 0, 0);
  }

  async getMessages(dto: UserReqDTO.MessageList): Promise<UserResDTO.MessageList> {
    void dto;
    return UserMapper.toMessageList(null);
  }

  private toRoleName(role: UserRole): string {
    switch (role) {
      case UserRole.USER:
        return '일반 사용자';
      case UserRole.DEPART_ADMIN:
        return '부서 관리자';
      case UserRole.TOTAL_ADMIN:
        return '시스템 관리자';
    }
  }
}
