import {
    Column,
    Entity,
    JoinColumn,
    ManyToOne,
    OneToOne,
    PrimaryGeneratedColumn
} from "typeorm";
import type { Relation } from "typeorm";
import { MaskingReportDAO } from "./masking-report.dao.js";
import { PromptRoomDAO } from "./prompt-room.dao.js";
import { MaskingReportStatus } from "../type/masking-report-status.enum.js";

export const PROMPT_LOG_TABLE = 'prompt_log' as const;

@Entity(PROMPT_LOG_TABLE)
export class PromptLogDAO {
    @PrimaryGeneratedColumn({ name: 'prompt_log_id', type: 'bigint' })
    promptLogId!: string;

    @Column({
        name: 'status',
        type: 'varchar',
        length: 10,
        nullable: true,
        default: MaskingReportStatus.PENDING
    })
    status!: MaskingReportStatus | null;

    @Column({ name: 'communicated_at', type: 'timestamp' })
    communicatedAt!: Date;

    @Column({ name: 'model_type', type: 'varchar', length: 50 })
    modelType!: string;

    @Column({ name: 'response_text', type: 'text', nullable: true })
    responseText!: string | null;

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
}
