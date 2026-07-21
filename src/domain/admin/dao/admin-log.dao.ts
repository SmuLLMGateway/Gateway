import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

export const ADMIN_LOG_TABLE = 'admin_log' as const;

@Entity(ADMIN_LOG_TABLE)
export class AdminLogDAO {
    @PrimaryGeneratedColumn({ name: 'admin_log_id', type: 'bigint' })
    adminLogId!: string;

    @Column({ name: 'log_content', type: 'varchar', length: 255 })
    logContent!: string;

    @Column({ name: 'action_at', type: 'timestamp' })
    actionAt!: Date;

    @Column({ name: 'action_member_name', type: 'varchar', length: 10 })
    actionMemberName!: string;
}
