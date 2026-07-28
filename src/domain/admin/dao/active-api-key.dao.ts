import {
    Column,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn
} from "typeorm";
import type { Relation } from "typeorm";
import { ActiveLlmDAO } from "./active-llm.dao.js";
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

    /** 이 API 키를 통한 부서 한도입니다. 0은 무제한을 의미합니다. */
    @Column({ name: 'limit', type: 'bigint', default: 0 })
    limit!: string;

    /** 이 API 키를 통한 부서의 현재 사용량입니다. */
    @Column({ name: 'usage', type: 'bigint', default: 0 })
    usage!: string;

    /** 직전 집계 기간의 API 키 사용률(%)입니다. */
    @Column({ name: 'recent_use_percent', type: 'bigint', default: 0 })
    recentUsePercent!: string;

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

    @OneToMany(
        () => ActiveLlmDAO,
        (activeLlm) => activeLlm.activeApiKey
    )
    activeLlms?: Relation<ActiveLlmDAO[]>;
}
