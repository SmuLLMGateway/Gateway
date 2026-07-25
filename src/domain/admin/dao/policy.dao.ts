import {
    Column,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn
} from "typeorm";
import type { Relation } from "typeorm";
import { DepartmentDAO } from "./department.dao.js";
import { MASKING_CONTENT } from "../../prompt/type/masking-content.type.js";

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
        enum: Object.values(MASKING_CONTENT)
    })
    maskingContent!: string;

    @Column({ name: 'masking_class', type: 'enum', enum: MaskingClass })
    maskingClass!: MaskingClass;

    @Column({ name: 'is_active', type: 'boolean', default: true })
    isActive!: boolean;

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
