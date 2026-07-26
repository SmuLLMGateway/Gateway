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
import { LlmDetailModelDAO } from './llm-detail-model.dao.js';

export const ACTIVE_LLM_TABLE = 'active_llm' as const;

@Entity(ACTIVE_LLM_TABLE)
@Index(
  'UQ_active_llm_active_key_detail_model',
  ['activeApiKeyId', 'llmDetailModelId'],
  { unique: true },
)
@Index('IDX_active_llm_llm_detail_model_id', ['llmDetailModelId'])
export class ActiveLlmDAO {
  @PrimaryGeneratedColumn({ name: 'active_llm_id', type: 'bigint' })
  activeLlmId!: string;

  @Column({ name: 'active_api_key_id', type: 'bigint' })
  activeApiKeyId!: string;

  @Column({ name: 'llm_detail_model_id', type: 'bigint' })
  llmDetailModelId!: string;

  @ManyToOne(
    () => ActiveApiKeyDAO,
    (activeApiKey) => activeApiKey.activeLlms,
    { nullable: false },
  )
  @JoinColumn({ name: 'active_api_key_id' })
  activeApiKey!: Relation<ActiveApiKeyDAO>;

  @ManyToOne(
    () => LlmDetailModelDAO,
    (llmDetailModel) => llmDetailModel.activeLlms,
    { nullable: false },
  )
  @JoinColumn({ name: 'llm_detail_model_id' })
  llmDetailModel!: Relation<LlmDetailModelDAO>;
}
