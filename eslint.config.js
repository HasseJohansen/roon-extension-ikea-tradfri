import jestPlugin from 'eslint-plugin-jest';

export default [
    {
        ignores: [
            'node_modules/',
            'package-lock.json',
            '.reg/',
            '.agent-shell/',
            '.github/'
        ]
    },
    {
        files: ['**/*.js'],
        languageOptions: {
            globals: {
                ...jestPlugin.environments.globals.globals
            },
            ecmaVersion: 'latest',
            sourceType: 'module'
        },
        plugins: {
            jest: jestPlugin
        },
        rules: {
            'indent': ['error', 4],
            'linebreak-style': ['error', 'unix'],
            'quotes': 'off',
            'semi': ['error', 'always'],
            'no-console': 'error',
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            'no-var': 'error',
            'prefer-const': 'error',
            'eqeqeq': ['error', 'always']
        }
    }
];
