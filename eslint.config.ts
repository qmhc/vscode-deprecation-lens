import factory from '@vexip-ui/eslint-config'

export default [
  ...factory({ ignores: ['**/out'] }),
  {
    files: ['scripts/**'],
    rules: {
      'no-console': 'off',
    },
  },
] satisfies import('eslint').Linter.Config[]
