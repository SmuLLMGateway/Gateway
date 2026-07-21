import {
    Column,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn
} from "typeorm";
import type { Relation } from "typeorm";
import { PromptRoomDAO } from "./prompt-room.dao.js";

export const PROMPT_LOG_TABLE = 'prompt_log' as const;

@Entity(PROMPT_LOG_TABLE)
export class PromptLogDAO {
    @PrimaryGeneratedColumn({ name: 'prompt_log_id', type: 'bigint' })
    promptLogId!: string;

    @Column({ name: 'original_text', type: 'text' })
    originalText!: string;

    @Column({
        name: 'file_url',
        type: 'varchar',
        length: 255,
        nullable: true
    })
    fileUrl!: string | null;

    @Column({ name: 'masking_text', type: 'text' })
    maskingText!: string;

    @Column({ name: 'communicated_at', type: 'timestamp' })
    communicatedAt!: Date;

    @Column({ name: 'model_type', type: 'varchar', length: 50 })
    modelType!: string;

    @Column({ name: 'response_text', type: 'text', nullable: true })
    responseText!: string | null;

    @Column({
        name: 'prompt_room_id',
        type: 'bigint'
    })
    promptRoomId!: string;

    @ManyToOne(() => PromptRoomDAO, {
        nullable: false
    })
    @JoinColumn({ name: 'prompt_room_id' })
    promptRoom!: Relation<PromptRoomDAO>;
}
