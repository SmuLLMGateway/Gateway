import {
    Column,
    Entity,
    Index,
    OneToMany,
    PrimaryGeneratedColumn
} from "typeorm";
import type { Relation } from "typeorm";
import { DepartmentPolicyDAO } from "./department-policy.dao.js";

export const DEPARTMENT_TABLE = 'department' as const;

@Entity(DEPARTMENT_TABLE)
@Index('UQ_department_department_name', ['departmentName'], { unique: true })
export class DepartmentDAO {
    @PrimaryGeneratedColumn({ name: 'department_id', type: 'bigint' })
    departmentId!: string;

    @Column({
        name: 'department_name',
        type: 'varchar',
        length: 255
    })
    departmentName!: string;

    /** 부서를 식별하는 운영 코드입니다. */
    @Column({ name: 'department_code', type: 'varchar', length: 10 })
    departmentCode!: string;

    /** 부서 공통 한도입니다. 0은 무제한을 의미합니다. */
    @Column({ name: 'limit', type: 'bigint', default: 0 })
    limit!: string;

    /** 부서의 현재 사용량입니다. */
    @Column({ name: 'usage', type: 'decimal', precision: 20, scale: 6, default: 0 })
    usage!: string;

    /** 직전 집계 기간의 부서 사용률(%)입니다. */
    @Column({ name: 'recent_use_percent', type: 'bigint', default: 0 })
    recentUsePercent!: string;

    @Column({ name: 'must_filtering', type: 'boolean', default: true })
    mustFiltering!: boolean;

    /** false이면 정규식·파일 저장만 수행하고 LPL(Local NER·LLM) 호출을 하지 않습니다. */
    @Column({ name: 'active_local_llm', type: 'boolean', default: true })
    activeLocalLLM!: boolean;

    @OneToMany(
        () => DepartmentPolicyDAO,
        (departmentPolicy) => departmentPolicy.department
    )
    departmentPolicies?: Relation<DepartmentPolicyDAO[]>;
}
