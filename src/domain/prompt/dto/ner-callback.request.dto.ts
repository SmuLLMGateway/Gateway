import { ApiProperty, ApiSchema } from '@nestjs/swagger';

export type NerCallbackStatus = 'DONE' | 'CANCEL';

@ApiSchema({ name: 'NerCallbackDetectionRequest' })
export class NerCallbackDetectionRequestDTO {
  @ApiProperty({
    example: 'PHONE',
    description: 'NER 서버가 탐지한 마스킹 항목',
    maxLength: 255,
  })
  maskingContent!: string;
}

@ApiSchema({ name: 'NerCallbackRequest' })
export class NerCallbackRequestDTO {
  @ApiProperty({
    example: 'a81cc17e-e10a-46ae-8113-dceffb932d6c',
    description: '분석 요청 티켓',
    format: 'uuid',
  })
  ticket!: string;

  @ApiProperty({
    example: 'DONE',
    description: 'NER 분석 완료 상태',
    enum: ['DONE', 'CANCEL'],
  })
  status!: NerCallbackStatus;

  @ApiProperty({
    type: () => [NerCallbackDetectionRequestDTO],
    maxItems: 10_000,
    description: 'NER 서버가 탐지한 마스킹 항목 목록',
  })
  detections!: NerCallbackDetectionRequestDTO[];
}
