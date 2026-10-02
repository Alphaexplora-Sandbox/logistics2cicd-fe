import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', '.next/', 'out/', 'node_modules/'] },
  ...tseslint.configs.recommended,
);
