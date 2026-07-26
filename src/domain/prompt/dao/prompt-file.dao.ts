import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { MaskingReportDAO } from './masking-report.dao.js';

export const PROMPT_FILE_TABLE = 'prompt_file' as const;

@Entity(PROMPT_FILE_TABLE)
@Index('UQ_prompt_file_file_url', ['fileUrl'], { unique: true })
export class PromptFileDAO {
  @PrimaryGeneratedColumn({ name: 'prompt_file_id', type: 'bigint' })
  promptFileId!: string;

  @Column({
    name: 'file_url',
    type: 'varchar',
    length: 1_024,
    // Object-storage URLs are ASCII. Keeping this column single-byte allows
    // MySQL to build the unique index without exceeding InnoDB's 3072-byte
    // index-key limit under the database-wide utf8mb4 charset.
    charset: 'ascii',
    collation: 'ascii_bin',
    nullable: false,
  })
  /** `s3://{bucket}/{objectKey}` 형식으로 버킷과 객체명을 함께 보존합니다. */
  fileUrl!: string;

  @Column({
    name: 'file_original_name',
    type: 'varchar',
    length: 1_024,
    nullable: false,
  })
  fileOriginalName!: string;

  @Column({
    name: 'masking_report_id',
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  maskingReportId!: string;

  @ManyToOne(() => MaskingReportDAO, { nullable: false })
  @JoinColumn({ name: 'masking_report_id' })
  maskingReport!: Relation<MaskingReportDAO>;
}
