import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { ActiveApiKeyDAO } from '../../admin/dao/active-api-key.dao.js';
import { MemberDAO } from './member.dao.js';

export const MEMBER_LIMIT_TABLE = 'member_limit' as const;

@Entity(MEMBER_LIMIT_TABLE)
export class MemberLimitDAO {
  @PrimaryGeneratedColumn({ name: 'member_limit_id', type: 'bigint' })
  memberLimitId!: string;

  /** 회원별 API 키 잔여 한도입니다. 사용량만큼 차감됩니다. */
  @Column({ name: 'limit', type: 'bigint' })
  limit!: string;

  @Column({ name: 'member_id', type: 'bigint' })
  memberId!: string;

  @Column({ name: 'active_api_key_id', type: 'bigint' })
  activeApiKeyId!: string;

  @ManyToOne(() => MemberDAO, { nullable: false })
  @JoinColumn({ name: 'member_id' })
  member!: Relation<MemberDAO>;

  @ManyToOne(() => ActiveApiKeyDAO, { nullable: false })
  @JoinColumn({ name: 'active_api_key_id' })
  activeApiKey!: Relation<ActiveApiKeyDAO>;
}
