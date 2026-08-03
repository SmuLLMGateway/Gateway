import { Injectable } from '@nestjs/common';
import { UserReqDTO } from '../dto/user.request.dto.js';
import { UserResDTO } from '../dto/user.response.dto.js';
import { UserMapper } from '../mapper/user.mapper.js';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, MoreThanOrEqual, Not, Repository } from 'typeorm';
import { MemberDAO } from '../dao/member.dao.js';
import { MemberDepartmentDAO } from '../dao/member-department.dao.js';
import { DepartmentDAO } from '../../admin/dao/department.dao.js';
import { MaskingDetailDAO } from '../../prompt/dao/masking-detail.dao.js';
import { PromptLogDAO } from '../../prompt/dao/prompt-log.dao.js';
import type { AuthenticatedUser } from '../../../global/security/type/jwt-payload.type.js';
import { AuthException } from '../../auth/exception/auth.exception.js';
import { AuthErrorStatus } from '../../auth/code/auth.status.js';
import { UserRole } from '../../../global/security/type/user-role.enum.js';
import { toKoreaStandardTimeISOString } from '../../../global/time/korea-standard-time.js';
import { MemberLimitDAO } from '../dao/member-limit.dao.js';
import { UserErrorStatus } from '../code/user.status.js';
import { UserException } from '../exception/user.exception.js';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(MemberDAO)
    private readonly memberRepository: Repository<MemberDAO>,
    @InjectRepository(MemberDepartmentDAO)
    private readonly memberDepartmentRepository: Repository<MemberDepartmentDAO>,
    @InjectRepository(DepartmentDAO)
    private readonly departmentRepository: Repository<DepartmentDAO>,
    @InjectRepository(MemberLimitDAO)
    private readonly memberLimitRepository: Repository<MemberLimitDAO>,
    @InjectRepository(PromptLogDAO)
    private readonly promptLogRepository: Repository<PromptLogDAO>,
    @InjectRepository(MaskingDetailDAO)
    private readonly maskingDetailRepository: Repository<MaskingDetailDAO>,
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
    if (member === null) {
      throw new AuthException(AuthErrorStatus.USER_NOT_FOUND);
    }

    if (membership === null && member.authorize !== UserRole.TOTAL_ADMIN) {
      throw new AuthException(AuthErrorStatus.USER_NOT_FOUND);
    }

    const department = membership === null
      ? null
      : await this.departmentRepository.findOneBy({
        departmentId: membership.departmentId,
      });
    if (membership !== null && department === null) {
      throw new AuthException(AuthErrorStatus.USER_NOT_FOUND);
    }

    const monthStart = this.getCurrentMonthStart();
    const [memberLimits, promptLogs] = await Promise.all([
      this.memberLimitRepository.find({
        select: { usage: true },
        where: { memberId: String(authentication.userId) },
      }),
      this.promptLogRepository.find({
        select: {
          promptLogId: true,
          maskingReportId: true,
          maskingReport: { maskingReportId: true },
        },
        relations: { maskingReport: true },
        where: {
          communicatedAt: MoreThanOrEqual(monthStart),
          maskingReport: { memberId: String(authentication.userId) },
        },
      }),
    ]);
    const reportIds = promptLogs.map(({ maskingReportId }) => maskingReportId);
    const detectedReports = reportIds.length === 0
      ? []
      : await this.maskingDetailRepository.find({
        select: { maskingReportId: true },
        where: { maskingReportId: In(reportIds) },
      });

    return {
      email: member.email,
      name: member.memberName,
      department: department?.departmentName ?? null,
      authorize: this.toRoleName(member.authorize),
      filter: new Set(detectedReports.map(({ maskingReportId }) => maskingReportId)).size,
      personalLimitRate: this.sumUsages(memberLimits),
      departmentLimitRate: Number(department?.usage ?? 0),
    };
  }

  async getMessageSummary(
    authentication: Readonly<AuthenticatedUser>,
  ): Promise<UserResDTO.MessageSummary> {
    const dashboard = await this.promptLogRepository
      .createQueryBuilder('promptLog')
      .innerJoin('promptLog.maskingReport', 'maskingReport')
      .leftJoin(
        MaskingDetailDAO,
        'maskingDetail',
        'maskingDetail.maskingReportId = promptLog.maskingReportId',
      )
      .where('maskingReport.member_id = :memberId', {
        memberId: String(authentication.userId),
      })
      .andWhere('promptLog.communicated_at IS NOT NULL')
      .select('COUNT(DISTINCT promptLog.promptLogId)', 'totalChatCnt')
      .addSelect(
        'COUNT(DISTINCT CASE WHEN maskingDetail.maskingDetailId IS NOT NULL THEN promptLog.promptLogId END)',
        'filter',
      )
      .addSelect(
        "COUNT(DISTINCT CASE WHEN maskingDetail.maskingDetailId IS NOT NULL AND LOWER(promptLog.modelType) NOT LIKE 'local%' THEN promptLog.promptLogId END)",
        'masking',
      )
      .addSelect(
        "COUNT(DISTINCT CASE WHEN LOWER(promptLog.modelType) LIKE 'local%' THEN promptLog.promptLogId END)",
        'local',
      )
      .getRawOne<{
        totalChatCnt: string;
        filter: string;
        masking: string;
        local: string;
      }>();
    const totalChatCnt = Number(dashboard?.totalChatCnt ?? 0);
    const filter = Number(dashboard?.filter ?? 0);
    const local = Number(dashboard?.local ?? 0);

    return UserMapper.toMessageSummary(
      toKoreaStandardTimeISOString(new Date()),
      totalChatCnt,
      filter,
      this.toRatioPercent(filter, totalChatCnt),
      Number(dashboard?.masking ?? 0),
      local,
      this.toRatioPercent(local, totalChatCnt),
    );
  }

  async getMessages(
    dto: Readonly<UserReqDTO.MessageList>,
    authentication: Readonly<AuthenticatedUser>,
  ): Promise<UserResDTO.MessageList> {
    const pageSize = this.toPositiveInteger(dto.pageSize, 10, 100);
    const pageNumber = this.toPositiveInteger(dto.pageNumber, 1, Number.MAX_SAFE_INTEGER);
    const since = this.toMessageHistorySince(dto.recent);
    const [promptLogs, totalCnt] = await this.promptLogRepository.findAndCount({
      select: {
        // 관계 조회 + 페이지네이션에서 TypeORM이 만드는 DISTINCT 정렬 쿼리에는
        // 정렬 키가 SELECT에 포함되어야 합니다. 응답에는 maskingReportId만 반환합니다.
        promptLogId: true,
        promptSummary: true,
        communicatedAt: true,
        modelType: true,
        maskingReportId: true,
        maskingReport: { maskingReportId: true },
      },
      relations: { maskingReport: true },
      where: {
        communicatedAt: since === null
          ? Not(IsNull())
          : MoreThanOrEqual(since),
        maskingReport: { memberId: String(authentication.userId) },
      },
      order: { communicatedAt: 'DESC', promptLogId: 'DESC' },
      take: pageSize,
      skip: (pageNumber - 1) * pageSize,
    });
    if (totalCnt === 0) {
      return null;
    }

    const reportIds = promptLogs.map(({ maskingReportId }) => maskingReportId);
    const details = await this.maskingDetailRepository.find({
      select: { maskingReportId: true },
      where: { maskingReportId: In(reportIds) },
    });
    const detectCntByReportId = new Map<string, number>();
    for (const { maskingReportId } of details) {
      detectCntByReportId.set(
        maskingReportId,
        (detectCntByReportId.get(maskingReportId) ?? 0) + 1,
      );
    }

    return {
      data: promptLogs.map((promptLog) => ({
        promptId: promptLog.maskingReportId,
        promptSummary: promptLog.promptSummary,
        promptedAt: this.toDateTimeString(promptLog.communicatedAt),
        llmModel: promptLog.modelType,
        detectCnt: detectCntByReportId.get(promptLog.maskingReportId) ?? 0,
      })),
      totalCnt,
      dataCnt: promptLogs.length,
      pageNumber,
    };
  }

  private getCurrentMonthStart(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }

  private sumUsages(items: readonly Readonly<{ usage: string }>[]): number {
    return items.reduce((sum, { usage }) => sum + Number(usage), 0);
  }

  private toRatioPercent(numerator: number, denominator: number): number {
    if (denominator === 0) {
      return 0;
    }

    return Math.round((numerator / denominator) * 1_000) / 10;
  }

  private toMessageHistorySince(recent: string): Date | null {
    const days = recent === '7d'
      ? 7
      : recent === '30d'
        ? 30
        : recent === '90d'
          ? 90
          : recent === 'all'
            ? null
            : undefined;
    if (days === undefined) {
      throw new UserException(UserErrorStatus.INVALID_MESSAGE_LIST);
    }
    if (days === null) {
      return null;
    }

    const since = new Date();
    since.setDate(since.getDate() - days);
    return since;
  }

  private toPositiveInteger(value: number, fallback: number, maximum: number): number {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return fallback;
    }

    return Math.min(parsed, maximum);
  }

  private toDateTimeString(value: Date | null): string {
    if (value === null) {
      return '';
    }

    return toKoreaStandardTimeISOString(value);
  }

  private toRoleName(role: UserRole): string {
    switch (role) {
      case UserRole.USER:
        return '일반 사용자';
      case UserRole.DEPART_ADMIN:
        return '부서 관리자';
      case UserRole.TOTAL_ADMIN:
        return '총 관리자';
    }
  }
}
