import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { DepartmentPolicyDAO } from '../../admin/dao/department-policy.dao.js';
import { MaskingReportDAO } from './masking-report.dao.js';

export const MASKING_DETAIL_TABLE = 'masking_detail' as const;

@Entity(MASKING_DETAIL_TABLE)
export class MaskingDetailDAO {
  @PrimaryGeneratedColumn({ name: 'masking_detail_id', type: 'bigint' })
  maskingDetailId!: string;

  /** 파일에서 탐지된 데이터인 경우 null입니다. */
  @Column({ name: 'original_text', type: 'varchar', length: 255, nullable: true })
  originalText!: string | null;

  /** 파일에서 탐지된 데이터인 경우 null입니다. */
  @Column({ name: 'start_idx', type: 'int', nullable: true })
  startIdx!: number | null;

  /** 텍스트에서 탐지된 데이터인 경우 null입니다. */
  @Column({ name: 'file_url', type: 'varchar', length: 255, nullable: true })
  fileUrl!: string | null;

  @Column({ name: 'masking_text', type: 'varchar', length: 255, nullable: true })
  maskingText!: string | null;

  @Column({ name: 'masking_report_id', type: 'varchar', length: 255 })
  maskingReportId!: string;

  @Column({ name: 'department_policy_id', type: 'bigint' })
  departmentPolicyId!: string;

  @ManyToOne(() => MaskingReportDAO, { nullable: false })
  @JoinColumn({ name: 'masking_report_id' })
  maskingReport!: Relation<MaskingReportDAO>;

  @ManyToOne(() => DepartmentPolicyDAO, { nullable: false })
  @JoinColumn({ name: 'department_policy_id' })
  departmentPolicy!: Relation<DepartmentPolicyDAO>;
}
