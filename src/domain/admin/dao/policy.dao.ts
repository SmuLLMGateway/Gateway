import {
    Column,
    Entity,
    OneToMany,
    PrimaryGeneratedColumn
} from "typeorm";
import type { Relation } from "typeorm";
import { DepartmentPolicyDAO } from "./department-policy.dao.js";
import { SECURITY_POLICY_CONTENTS } from "../policy/security-policy.catalog.js";

export const POLICY_TABLE = 'policy' as const;

export enum MaskingClass {
    SENSITIVE = 'SENSITIVE',
    PRIVATE = 'PRIVATE'
}

@Entity(POLICY_TABLE)
export class PolicyDAO {
    @PrimaryGeneratedColumn({ name: 'policy_id', type: 'bigint' })
    policyId!: string;

    @Column({
        name: 'masking_content',
        type: 'enum',
        enum: SECURITY_POLICY_CONTENTS
    })
    maskingContent!: string;

    @Column({ name: 'masking_class', type: 'enum', enum: MaskingClass })
    maskingClass!: MaskingClass;

    @OneToMany(
        () => DepartmentPolicyDAO,
        (departmentPolicy) => departmentPolicy.policy
    )
    departmentPolicies?: Relation<DepartmentPolicyDAO[]>;
}
