import {
    Column,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn
} from "typeorm";
import type { Relation } from "typeorm";
import { PolicyDAO } from "../../admin/dao/policy.dao.js";
import { PromptLogDAO } from "./prompt-log.dao.js";

export const PROMPT_MASKING_TABLE = 'prompt_masking' as const;

@Entity(PROMPT_MASKING_TABLE)
export class PromptMaskingDAO {
    @PrimaryGeneratedColumn({ name: 'prompt_masking_id', type: 'bigint' })
    promptMaskingId!: string;

    /** 파일 탐지 데이터인 경우 null */
    @Column({ name: 'masking_text', type: 'varchar', length: 255, nullable: true })
    maskingText!: string | null;

    @Column({
        name: 'prompt_log_id',
        type: 'bigint'
    })
    promptLogId!: string;

    @Column({
        name: 'policy_id',
        type: 'bigint'
    })
    policyId!: string;

    @ManyToOne(() => PolicyDAO, {
        nullable: false
    })
    @JoinColumn({ name: 'policy_id' })
    policy!: Relation<PolicyDAO>;

    @ManyToOne(() => PromptLogDAO, {
        nullable: false
    })
    @JoinColumn({ name: 'prompt_log_id' })
    promptLog!: Relation<PromptLogDAO>;
}
