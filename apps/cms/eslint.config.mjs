import nextjsConfig from '@encreasl/eslint-config/nextjs'

export default [
  ...nextjsConfig,
  {
    ignores: ['.next/', '**/*.cjs', 'src/payload-generated-schema.ts', 'src/payload-types.ts'],
  },
]
