import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { MemberDAO } from '../../user/dao/member.dao.js';
import { MaskingReportStatus } from '../type/masking-report-status.enum.js';

export const MASKING_REPORT_TABLE = 'masking_report' as const;

@Entity(MASKING_REPORT_TABLE)
export class MaskingReportDAO {
  /** 클라이언트가 생성한 UUID ticket을 PK로 사용합니다. */
  @PrimaryColumn({ name: 'masking_report_id', type: 'varchar', length: 255 })
  maskingReportId!: string;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 10,
    default: MaskingReportStatus.PENDING,
  })
  status!: MaskingReportStatus;

  @Column({
    name: 'regex_status',
    type: 'varchar',
    length: 10,
    default: MaskingReportStatus.PENDING,
  })
  regexStatus!: MaskingReportStatus;

  @Column({
    name: 'ner_status',
    type: 'varchar',
    length: 10,
    default: MaskingReportStatus.PENDING,
  })
  nerStatus!: MaskingReportStatus;

  @Column({ name: 'member_id', type: 'bigint' })
  memberId!: string;

  @Column({ name: 'original_text', type: 'text', nullable: false })
  originalText!: string;

  @Column({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

  @ManyToOne(() => MemberDAO, { nullable: false })
  @JoinColumn({ name: 'member_id' })
  member!: Relation<MemberDAO>;

  @Column({
    name: 'recent_masking_report_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  recentMaskingReportId!: string | null;

  @ManyToOne(() => MaskingReportDAO, { nullable: true })
  @JoinColumn({ name: 'recent_masking_report_id' })
  recentMaskingReport!: Relation<MaskingReportDAO> | null;
}
