import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserResDTO } from '../dto/user.response.dto.js';
import { MemberDAO } from '../dao/member.dao.js';
import { MemberDepartmentDAO } from '../dao/member-department.dao.js';
import { MemberLimitDAO } from '../dao/member-limit.dao.js';
import { UserData } from '../data/user.data.js';

@Injectable()
export class UserMapper {
  constructor(
    @InjectRepository(MemberDAO)
    private readonly memberRepository: Repository<MemberDAO>,
    @InjectRepository(MemberDepartmentDAO)
    private readonly memberDepartmentRepository: Repository<MemberDepartmentDAO>,
    @InjectRepository(MemberLimitDAO)
    private readonly memberLimitRepository: Repository<MemberLimitDAO>,
  ) {}

  toMemberDAO(data: Readonly<UserData.CreateMember>): MemberDAO {
    return this.memberRepository.create({
      memberName: data.memberName,
      email: data.email,
      password: data.password,
      authorize: data.authorize,
      profileUrl: data.profileUrl,
      refreshToken: data.refreshToken,
      loginAt: data.loginAt,
      createdAt: data.createdAt,
      createdBy: data.createdBy,
      disabledAt: data.disabledAt,
    });
  }

  toMemberLimitDAO(
    data: Readonly<UserData.CreateMemberLimit>,
  ): MemberLimitDAO {
    return this.memberLimitRepository.create({
      limit: data.limit,
      memberId: data.memberId,
      activeApiKeyId: data.activeApiKeyId,
    });
  }

  toMemberDepartmentDAO(
    data: Readonly<UserData.CreateMemberDepartment>,
  ): MemberDepartmentDAO {
    return this.memberDepartmentRepository.create({
      memberId: data.memberId,
      departmentId: data.departmentId,
    });
  }

  static toMessageSummary(
    updatedAt: string,
    totalChatCnt: number,
    filter: number,
    masking: number,
    local: number,
    localPercent: number,
  ): UserResDTO.MessageSummary {
    return {
      updatedAt,
      totalChatCnt,
      filter,
      masking,
      local,
      localPercent,
    };
  }

  static toMessageList<T>(result: T): T {
    return result;
  }
}
