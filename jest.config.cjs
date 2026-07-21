module.exports = {
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.spec.ts'],
  testEnvironment: 'node',
  clearMocks: true,
  restoreMocks: true,
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': [
      '@swc/jest',
      {
        jsc: {
          parser: {
            syntax: 'typescript',
            decorators: true,
          },
          transform: {
            legacyDecorator: true,
            decoratorMetadata: true,
          },
          target: 'es2022',
          keepClassNames: true,
        },
        module: {
          type: 'commonjs',
        },
      },
    ],
  },
  collectCoverageFrom: [
    'src/domain/auth/controller/auth.controller.ts',
    'src/domain/auth/service/auth.service.ts',
    'src/domain/admin/controller/admin.controller.ts',
    'src/domain/admin/service/admin.service.ts',
    'src/domain/prompt/controller/prompt.controller.ts',
    'src/domain/prompt/service/prompt.service.ts',
    'src/domain/prompt/service/regex-masking-detector.service.ts',
    'src/domain/prompt/client/ner.client.ts',
    'src/global/security/guard/*.ts',
  ],
};
