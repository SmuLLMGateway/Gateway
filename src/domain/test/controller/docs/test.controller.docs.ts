import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

export const TestControllerDocs = () => {
  return applyDecorators(
    ApiTags('Test')
  );
};

export const GetHelloDocs = () => {
  return applyDecorators(
    ApiOperation({ summary: '헬스 체크 API' }),
    ApiResponse({ status: 200, description: '성공적으로 조회됨.' })
  );
};

export const GetExceptionDocs = () => {
  return applyDecorators(
    ApiOperation({ summary: '예외 테스트 API' }),
    ApiResponse({ status: 400, description: '예외 발생' })
  );
};
  
