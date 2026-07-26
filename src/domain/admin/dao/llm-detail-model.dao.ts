import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { ActiveLlmDAO } from './active-llm.dao.js';

export const LLM_DETAIL_MODEL_TABLE = 'llm_detail_model' as const;

@Entity(LLM_DETAIL_MODEL_TABLE)
export class LlmDetailModelDAO {
  @PrimaryGeneratedColumn({ name: 'llm_detail_model_id', type: 'bigint' })
  llmDetailModelId!: string;

  @Column({ name: 'llm_name', type: 'varchar', length: 50, nullable: true })
  llmName!: string | null;

  @OneToMany(
    () => ActiveLlmDAO,
    (activeLlm) => activeLlm.llmDetailModel,
  )
  activeLlms?: Relation<ActiveLlmDAO[]>;
}
