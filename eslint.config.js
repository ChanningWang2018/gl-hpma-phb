import globals from 'globals';
import pluginVue from 'eslint-plugin-vue';
import configPrettier from '@vue/eslint-config-prettier';

export default [
  // Never lint build output, raw data snapshots, static assets or vendored code.
  {
    ignores: ['dist/', 'archive/', 'public/', 'node_modules/', 'design-lab/'],
  },

  // Shared language environment for the project's own sources.
  {
    files: [
      'src/**/*.{js,vue}',
      'scripts/**/*.{js,mjs}',
      'tests/**/*.js',
      '*.{js,mjs}',
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },

  // Vitest exposes its API globally (vitest.config.js sets test.globals: true),
  // so allow describe/it/expect/... in the test suite.
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.vitest,
      },
    },
  },

  // Vue SFCs: vue3-recommended ruleset (eslint-plugin-vue defaults to Vue 3).
  ...pluginVue.configs['flat/recommended'],

  // Must stay last: turns off stylistic rules that conflict with Prettier and
  // reports formatting drift through the `prettier/prettier` rule (warn).
  configPrettier,

  {
    rules: {
      // Single-word names (App, Header, Analytics, ...) would require renaming
      // files/components and touching routes — out of scope for a style pass.
      'vue/multi-word-component-names': 'off',
      // `Header` and `Line` are only reserved inside in-DOM templates; these
      // are SFC-rendered components, and renaming them would be a structural
      // change. Revisit if the app ever compiles templates from raw HTML.
      'vue/no-reserved-component-names': 'off',
    },
  },
];
