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

    /**
     * 외부 Provider는 암호화된 API 키를 저장하고, Local LLM 연결은 API 키를
     * 사용하지 않으므로 NULL을 저장합니다. Local LLM 여부는 serviceType으로
     * 구분합니다.
     */
    @Column({ name: 'api_key', type: 'varchar', length: 1024, nullable: true })
    apiKey!: string | null;

    @Column({ name: 'service_type', type: 'varchar', length: 255 })
    serviceType!: string;

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
