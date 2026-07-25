import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

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
}
