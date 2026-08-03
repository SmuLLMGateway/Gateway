import {
    Column,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    OneToOne,
    PrimaryGeneratedColumn
} from "typeorm";
import type { Relation } from "typeorm";
import { MaskingReportDAO } from "./masking-report.dao.js";
import { PromptRoomDAO } from "./prompt-room.dao.js";
import { PromptLogStatus } from '../type/prompt-log-status.enum.js';
import { ActiveApiKeyDAO } from '../../admin/dao/active-api-key.dao.js';

export const PROMPT_LOG_TABLE = 'prompt_log' as const;

@Entity(PROMPT_LOG_TABLE)
@Index('IDX_prompt_log_active_api_key_id', ['activeApiKeyId'])
export class PromptLogDAO {
    @PrimaryGeneratedColumn({ name: 'prompt_log_id', type: 'bigint' })
    promptLogId!: string;

    @Column({
        name: 'status',
        type: 'varchar',
        length: 10,
        default: PromptLogStatus.PENDING
    })
    status!: PromptLogStatus;

    @Column({ name: 'communicated_at', type: 'timestamp', nullable: true })
    communicatedAt!: Date | null;

    @Column({ name: 'model_type', type: 'varchar', length: 50, nullable: true })
    modelType!: string | null;

    /** 실제 Provider 요청에 사용할 세부 모델명입니다. */
    @Column({ name: 'model_name', type: 'varchar', length: 50, nullable: true })
    modelName!: string | null;

    @Column({ name: 'response_text', type: 'text', nullable: true })
    responseText!: string | null;

    /** 외부 LLM 호출에 사용한 사용량입니다. 내부 LLM 및 미전송 로그는 NULL입니다. */
    @Column({ name: 'usage', type: 'decimal', precision: 20, scale: 6, nullable: true })
    usage!: string | null;

    @Column({ name: 'prompt_summary', type: 'varchar', length: 50 })
    promptSummary!: string;

    @Column({
        name: 'prompt_room_id',
        type: 'varchar',
        length: 255
    })
    promptRoomId!: string;

    @Column({
        name: 'masking_report_id',
        type: 'varchar',
        length: 255
    })
    maskingReportId!: string;

    /** 외부 LLM 전송에 실제 사용한 API 키입니다. 로컬 LLM은 null입니다. */
    @Column({ name: 'active_api_key_id', type: 'bigint', nullable: true })
    activeApiKeyId!: string | null;

    @ManyToOne(() => PromptRoomDAO, {
        nullable: false
    })
    @JoinColumn({ name: 'prompt_room_id' })
    promptRoom!: Relation<PromptRoomDAO>;

    @OneToOne(() => MaskingReportDAO, {
        nullable: false
    })
    @JoinColumn({ name: 'masking_report_id' })
    maskingReport!: Relation<MaskingReportDAO>;

    @ManyToOne(() => ActiveApiKeyDAO, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'active_api_key_id' })
    activeApiKey!: Relation<ActiveApiKeyDAO | null>;
}
