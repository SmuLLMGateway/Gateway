import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { PresetPolicyDAO } from './preset-policy.dao.js';

export const PRESET_TABLE = 'preset' as const;

/** 기업 관리자가 정의하는 보안 정책 프리셋입니다. */
@Entity(PRESET_TABLE)
export class PresetDAO {
  @PrimaryGeneratedColumn({ name: 'policy_preset_id', type: 'bigint' })
  policyPresetId!: string;

  @Column({ name: 'name', type: 'varchar', length: 255, nullable: true })
  name!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @OneToMany(
    () => PresetPolicyDAO,
    (presetPolicy) => presetPolicy.preset,
  )
  presetPolicies?: Relation<PresetPolicyDAO[]>;
}
