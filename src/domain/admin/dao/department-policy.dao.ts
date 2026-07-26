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
import { PolicyDAO } from "./policy.dao.js";

export const DEPARTMENT_POLICY_TABLE = 'department_policy' as const;

@Entity(DEPARTMENT_POLICY_TABLE)
@Index(
    'UQ_department_policy_department_policy',
    ['departmentId', 'policyId'],
    { unique: true }
)
@Index('IDX_department_policy_department_id', ['departmentId'])
@Index('IDX_department_policy_policy_id', ['policyId'])
export class DepartmentPolicyDAO {
    @PrimaryGeneratedColumn({ name: 'department_policy_id', type: 'bigint' })
    departmentPolicyId!: string;

    @Column({ name: 'is_active', type: 'boolean' })
    isActive!: boolean;

    @Column({ name: 'department_id', type: 'bigint' })
    departmentId!: string;

    @Column({ name: 'policy_id', type: 'bigint' })
    policyId!: string;

    @ManyToOne(
        () => DepartmentDAO,
        (department) => department.departmentPolicies,
        { nullable: false }
    )
    @JoinColumn({ name: 'department_id' })
    department!: Relation<DepartmentDAO>;

    @ManyToOne(
        () => PolicyDAO,
        (policy) => policy.departmentPolicies,
        { nullable: false }
    )
    @JoinColumn({ name: 'policy_id' })
    policy!: Relation<PolicyDAO>;
}
