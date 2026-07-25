export class NerRequestException extends Error {
  constructor(options?: ErrorOptions) {
    super('NER 서버 요청에 실패했습니다.', options);
    this.name = NerRequestException.name;
  }
}
