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

    @Column({ name: 'must_filtering', type: 'boolean', default: true })
    mustFiltering!: boolean;

    @OneToMany(
        () => DepartmentPolicyDAO,
        (departmentPolicy) => departmentPolicy.department
    )
    departmentPolicies?: Relation<DepartmentPolicyDAO[]>;
}
