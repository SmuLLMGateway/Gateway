import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { UserRole } from "../../../global/security/type/user-role.enum.js";

export const MEMBER_TABLE = 'member' as const;

@Entity(MEMBER_TABLE)
export class MemberDAO {
    @PrimaryGeneratedColumn({ name: 'member_id', type: 'bigint' })
    memberId!: string;

    @Column({ name: 'member_name', type: 'varchar', length: 10 })
    memberName!: string;

    @Column({ name: 'email', type: 'varchar', length: 255, unique: true })
    email!: string;

    @Column({ name: 'password', type: 'varchar', length: 255, select: false })
    password!: string;

    @Column({
        name: 'authorize',
        type: 'enum',
        enum: UserRole,
        default: UserRole.USER
    })
    authorize!: UserRole;

    @Column({ name: 'profile_url', type: 'varchar', length: 255 })
    profileUrl!: string;

    @Column({
        name: 'refresh_token',
        type: 'varchar',
        length: 512,
        nullable: true,
        select: false
    })
    refreshToken!: string | null;

    @Column({ name: 'login_at', type: 'timestamp' })
    loginAt!: Date;

    @Column({ name: 'created_at', type: 'timestamp' })
    createdAt!: Date;

    @Column({ name: 'created_by', type: 'varchar', length: 10 })
    createdBy!: string;

    @Column({ name: 'disabled_at', type: 'timestamp', nullable: true })
    disabledAt!: Date | null;
}
