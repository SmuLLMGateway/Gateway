import {
    Column,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn
} from "typeorm";
import type { Relation } from "typeorm";
import { DepartmentDAO } from "./department.dao.js";

export const ACTIVE_API_KEY_TABLE = 'active_api_key' as const;

@Entity(ACTIVE_API_KEY_TABLE)
@Index(
    'UQ_active_api_key_department_service',
    ['departmentId', 'serviceType'],
    { unique: true }
)
export class ActiveApiKeyDAO {
    @PrimaryGeneratedColumn({ name: 'active_api_key_id', type: 'bigint' })
    activeApiKeyId!: string;

    @Column({ name: 'api_key', type: 'varchar', length: 1024 })
    apiKey!: string;

    @Column({ name: 'service_type', type: 'varchar', length: 255 })
    serviceType!: string;

    @Column({ name: 'department_limit', type: 'bigint' })
    departmentLimit!: string;

    @Column({ name: 'must_filtering', type: 'boolean', default: true })
    mustFiltering!: boolean;

    @Column({
        name: 'department_id',
        type: 'bigint'
    })
    departmentId!: string;

    @ManyToOne(() => DepartmentDAO, {
        nullable: false
    })
    @JoinColumn({ name: 'department_id' })
    department!: Relation<DepartmentDAO>;
}
