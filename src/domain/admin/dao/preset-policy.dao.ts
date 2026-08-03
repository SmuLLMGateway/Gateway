import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { PolicyDAO } from './policy.dao.js';
import { PresetDAO } from './preset.dao.js';

export const PRESET_POLICY_TABLE = 'preset_policy' as const;

/** 프리셋에 포함된 보안 정책 항목입니다. */
@Entity(PRESET_POLICY_TABLE)
@Index('IDX_preset_policy_policy_preset_id', ['policyPresetId'])
@Index('IDX_preset_policy_policy_id', ['policyId'])
export class PresetPolicyDAO {
  @PrimaryGeneratedColumn({ name: 'preset_policy_id', type: 'bigint' })
  presetPolicyId!: string;

  @Column({ name: 'policy_preset_id', type: 'bigint' })
  policyPresetId!: string;

  @Column({ name: 'policy_id', type: 'bigint' })
  policyId!: string;

  @ManyToOne(
    () => PresetDAO,
    (preset) => preset.presetPolicies,
    { nullable: false },
  )
  @JoinColumn({ name: 'policy_preset_id' })
  preset!: Relation<PresetDAO>;

  @ManyToOne(
    () => PolicyDAO,
    (policy) => policy.presetPolicies,
    { nullable: false },
  )
  @JoinColumn({ name: 'policy_id' })
  policy!: Relation<PolicyDAO>;
}
