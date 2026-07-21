import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MemberDAO } from '../../../domain/user/dao/member.dao.js';
import { SecurityErrorStatus } from '../code/security.status.js';
import { SecurityException } from '../exception/security.exception.js';
import type {
  AuthenticatedUser,
  VerifiedAccessToken,
} from '../type/jwt-payload.type.js';

@Injectable()
export class SecurityPrincipalService {
  constructor(
    @InjectRepository(MemberDAO)
    private readonly memberRepository: Repository<MemberDAO>,
  ) {}

  async getAuthenticatedUser(
    token: Readonly<VerifiedAccessToken>,
  ): Promise<AuthenticatedUser> {
    const member = await this.memberRepository.findOne({
      select: {
        memberId: true,
        authorize: true,
        disabledAt: true,
      },
      where: { memberId: String(token.userId) },
    });

    if (member === null) {
      throw new SecurityException(SecurityErrorStatus.USER_NOT_FOUND);
    }

    if (member.disabledAt !== null) {
      throw new SecurityException(SecurityErrorStatus.DISABLE_ACCOUNT);
    }

    return {
      ...token,
      role: member.authorize,
    };
  }
}
