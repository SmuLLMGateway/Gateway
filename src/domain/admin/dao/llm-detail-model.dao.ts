import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { ActiveApiKeyDAO } from './active-api-key.dao.js';

export const LLM_DETAIL_MODEL_TABLE = 'llm_detail_model' as const;

@Entity(LLM_DETAIL_MODEL_TABLE)
@Index(
  'UQ_llm_detail_model_active_key_name',
  ['activeApiKeyId', 'llmName'],
  { unique: true },
)
export class LlmDetailModelDAO {
  @PrimaryGeneratedColumn({ name: 'llm_detail_model_id', type: 'bigint' })
  llmDetailModelId!: string;

  @Column({ name: 'llm_name', type: 'varchar', length: 50, nullable: true })
  llmName!: string | null;

  @Column({ name: 'active_api_key_id', type: 'bigint' })
  activeApiKeyId!: string;

  @ManyToOne(() => ActiveApiKeyDAO, { nullable: false })
  @JoinColumn({ name: 'active_api_key_id' })
  activeApiKey!: Relation<ActiveApiKeyDAO>;
}
