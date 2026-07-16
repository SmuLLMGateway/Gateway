import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { setupSwagger } from './global/config/swagger.config.js';
import { ResponseInterceptor } from './global/apiPayload/interceptors/response.interceptor.js';
import {
  GlobalExceptionFilter,
  HttpExceptionFilter,
  BlockchainExceptionFilter,
} from './global/apiPayload/handler/exception.filter.js';
import * as dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. 기존 Express 미들웨어 설정
  app.use(cors());
  app.use(express.static('public'));
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // 2. Swagger 설정
  setupSwagger(app);

  // 3. 전역 응답 인터셉터 & 예외 필터 설정
  app.useGlobalInterceptors(new ResponseInterceptor());
  // 에러 발생 시 처리 우선순위(역순): BlockchainException/HttpException -> GlobalException
  app.useGlobalFilters(
    new GlobalExceptionFilter(),
    new HttpExceptionFilter(),
    new BlockchainExceptionFilter()
  );

  // 4. 서버 시작
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`[server]: Server is running at http://localhost:${port}`);
  console.log(`[swagger]: Swagger UI is running at http://localhost:${port}/api-docs`);
}
bootstrap();
