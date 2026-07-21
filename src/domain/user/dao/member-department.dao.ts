import {
    Column,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn
} from "typeorm";
import type { Relation } from "typeorm";
import { MemberDAO } from "./member.dao.js";
import { DepartmentDAO } from "../../admin/dao/department.dao.js";

export const MEMBER_DEPARTMENT_TABLE = 'member_department' as const;

@Entity(MEMBER_DEPARTMENT_TABLE)
export class MemberDepartmentDAO {
    @PrimaryGeneratedColumn({ name: 'member_department_id', type: 'bigint' })
    memberDepartmentId!: string;

    @Column({
        name: 'member_id',
        type: 'bigint'
    })
    memberId!: string;

    @Column({
        name: 'department_id',
        type: 'bigint'
    })
    departmentId!: string;

    @ManyToOne(() => MemberDAO, {
        nullable: false
    })
    @JoinColumn({ name: 'member_id' })
    member!: Relation<MemberDAO>;

    @ManyToOne(() => DepartmentDAO, {
        nullable: false
    })
    @JoinColumn({ name: 'department_id' })
    department!: Relation<DepartmentDAO>;
}
