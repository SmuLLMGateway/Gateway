import type { BaseStatus } from '../apiPayload/code/status.js';
import { ApiResponse } from '@nestjs/swagger';
import type { ApiResponseSchemaHost } from '@nestjs/swagger';

type ApiResponseDecorator = MethodDecorator & ClassDecorator;
type SchemaObject = ApiResponseSchemaHost['schema'];

const responseSchema = (
  isSuccess: boolean,
  status: BaseStatus,
  result: SchemaObject,
): SchemaObject => ({
  type: 'object',
  required: ['isSuccess', 'code', 'message', 'result'],
  properties: {
    isSuccess: { type: 'boolean', example: isSuccess },
    code: { type: 'string', example: status.code },
    message: { type: 'string', example: status.message },
    result,
  },
});

export const SwaggerResultSchema = {
  model: (schemaPath: string, nullable = false): SchemaObject => ({
    allOf: [{ $ref: schemaPath }],
    nullable,
  }),
  array: (schemaPath: string, nullable = false): SchemaObject => ({
    type: 'array',
    items: { $ref: schemaPath },
    nullable,
  }),
  string: (format?: string): SchemaObject => ({
    type: 'string',
    ...(format ? { format } : {}),
  }),
  null: (): SchemaObject => ({ nullable: true, example: null }),
  unknown: (): SchemaObject => ({ nullable: true, additionalProperties: true }),
};

export const ApiSuccessResponse = (
  status: BaseStatus,
  result: SchemaObject,
): ApiResponseDecorator =>
  ApiResponse({
    status: status.httpStatus,
    description: status.message,
    schema: responseSchema(true, status, result),
  });

export const ApiErrorResponses = (
  statuses: readonly BaseStatus[],
): ApiResponseDecorator[] => {
  const grouped = new Map<number, BaseStatus[]>();

  for (const status of statuses) {
    const values = grouped.get(status.httpStatus) ?? [];
    values.push(status);
    grouped.set(status.httpStatus, values);
  }

  return [...grouped.entries()].map(([httpStatus, values]) =>
    ApiResponse({
      status: httpStatus,
      description: values.map(({ code, message }) => `${code}: ${message}`).join(' / '),
      content: {
        'application/json': {
          schema: responseSchema(false, values[0]!, SwaggerResultSchema.null()),
          examples: Object.fromEntries(
            values.map((status) => [
              status.code,
              {
                summary: status.message,
                value: {
                  isSuccess: false,
                  code: status.code,
                  message: status.message,
                  result: null,
                },
              },
            ]),
          ),
        },
      },
    }),
  );
};
