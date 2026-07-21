import {
    Column,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn
} from "typeorm";
import type { Relation } from "typeorm";
import { MemberDAO } from "../../user/dao/member.dao.js";

export const PROMPT_ROOM_TABLE = 'prompt_room' as const;

@Entity(PROMPT_ROOM_TABLE)
export class PromptRoomDAO {
    @PrimaryGeneratedColumn({ name: 'prompt_room_id', type: 'bigint' })
    promptRoomId!: string;

    @Column({ name: 'started_at', type: 'timestamp' })
    startedAt!: Date;

    @Column({ name: 'last_communicated_at', type: 'timestamp' })
    lastCommunicatedAt!: Date;

    @Column({ name: 'prompt_room_title', type: 'varchar', length: 255 })
    promptRoomTitle!: string;

    @Column({
        name: 'member_id',
        type: 'bigint'
    })
    memberId!: string;

    @ManyToOne(() => MemberDAO, {
        nullable: false
    })
    @JoinColumn({ name: 'member_id' })
    member!: Relation<MemberDAO>;
}
