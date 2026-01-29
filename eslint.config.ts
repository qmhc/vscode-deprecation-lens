import factory from '@vexip-ui/eslint-config'

export default [
  ...factory({ ignores: ['**/out'] }),
  {
    files: ['scripts/**'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // Solid.js 使用不同的 JSX 规则
    files: ['packages/ui/**/*.tsx'],
    rules: {
      'react/jsx-curly-brace-presence': 'off',
      'react/self-closing-comp': 'off',
    },
  },
] satisfies import('eslint').Linter.Config[]
