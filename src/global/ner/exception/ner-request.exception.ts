export interface NerRequestExceptionOptions extends ErrorOptions {
  readonly status?: number;
}

export class NerRequestException extends Error {
  readonly status?: number;

  constructor(options?: NerRequestExceptionOptions) {
    super('NER 서버 요청에 실패했습니다.', options);
    this.name = NerRequestException.name;
    this.status = options?.status;
  }
}
