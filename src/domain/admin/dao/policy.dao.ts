import {
    Column,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn
} from "typeorm";
import type { Relation } from "typeorm";
import { DepartmentDAO } from "./department.dao.js";

export const POLICY_TABLE = 'policy' as const;

export enum MaskingClass {
    SENSITIVE = 'SENSITIVE',
    PRIVATE = 'PRIVATE'
}

@Entity(POLICY_TABLE)
export class PolicyDAO {
    @PrimaryGeneratedColumn({ name: 'policy_id', type: 'bigint' })
    policyId!: string;

    /** ERD에 PHONE, RESIDENT, CARD 외의 값이 생략되어 있어 문자열로 둡니다. */
    @Column({ name: 'masking_content', type: 'varchar', length: 255 })
    maskingContent!: string;

    @Column({ name: 'masking_class', type: 'enum', enum: MaskingClass })
    maskingClass!: MaskingClass;

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
