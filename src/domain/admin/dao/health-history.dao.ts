import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export const HEALTH_HISTORY_TABLE = 'health_history' as const;

/** 서비스 상태 점검 결과입니다. */
export enum HealthStatus {
  OK = 'OK',
  DELAY = 'DELAY',
  ERROR = 'ERROR',
  CHECK = 'CHECK',
}

/** health_history.service_name에 저장하는 표준 서비스명입니다. */
export const HealthServiceName = {
  GPT: 'GPT',
  GEMINI: 'Gemini',
  CLAUDE: 'Claude',
  LOCAL_LLM: 'Local LLM',
  SECURITY_FILTERING: 'Gateway Filtering',
  DATABASE: 'Database',
  STORAGE: 'MinIO',
  MONITORING: 'Monitoring',
} as const;

@Entity(HEALTH_HISTORY_TABLE)
export class HealthHistoryDAO {
  @PrimaryGeneratedColumn({ name: 'health_history_id', type: 'bigint' })
  healthHistoryId!: string;

  @Column({ name: 'service_name', type: 'varchar', length: 50 })
  serviceName!: string;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 10,
    default: HealthStatus.OK,
  })
  status!: HealthStatus;

  /** 서비스 응답 시간(ms)입니다. */
  @Column({ name: 'latency', type: 'int' })
  latency!: number;

  /** 상태 점검 결과가 적재된 시각입니다. */
  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    precision: 0,
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;
}
