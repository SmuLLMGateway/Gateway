import { Injectable } from '@nestjs/common';

@Injectable()
export class TestService {

  async getHello(
    message: string
  ): Promise<string> {
    return message+'!!';
  }
}
