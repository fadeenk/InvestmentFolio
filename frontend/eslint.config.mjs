// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  ignores: ['app/**/*.js'],
  rules: {
    'comma-dangle': ['error', 'always-multiline'], // enforce trailing commas in multiline constructs
    'max-len': ['error', { code: 160, ignoreUrls: true, ignoreStrings: true, ignoreTemplateLiterals: true }], // increase max line length to 160 characters
  },
})
// Your custom configs here
