import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';

// 이슈 #24의 2단계 (가)를 따른다. Airbnb 규칙을 빼고 Next.js 공식 설정만 쓴다.
// 아래 rules는 .eslintrc.cjs에서 직접 켜 두었던 규칙만 옮긴 것이다.
export default defineConfig([
  globalIgnores(['.next/**', 'out/**', 'build/**', 'coverage/**', 'next-env.d.ts']),
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    rules: {
      'react/jsx-filename-extension': ['warn', { extensions: ['.tsx'] }],
      'import/extensions': [
        'error',
        'ignorePackages',
        { js: 'never', jsx: 'never', ts: 'never', tsx: 'never' },
      ],
      'import/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: [
            '**/*.config.js',
            '**/*.config.ts',
            '**/*.config.mjs',
            'tailwind.config.ts',
            'next.config.ts',
            'postcss.config.js',
          ],
        },
      ],
      '@typescript-eslint/no-unused-vars': 'warn',
    },
  },
  {
    files: ['lib/kakao-test/**/*.ts', 'lib/auth/**/*.ts', 'scripts/kakao-test/**/*.mjs', 'scripts/auth-schema/**/*.mjs', 'tests/kakao-test/**/*.ts', 'tests/auth-schema/**/*.ts', 'tests/service-auth/**/*.ts'],
    // Node 24의 내장 TypeScript 실행기는 상대 import의 확장자를 요구한다.
    rules: { 'import/extensions': ['error', 'ignorePackages', { ts: 'always' }] },
  },
]);
