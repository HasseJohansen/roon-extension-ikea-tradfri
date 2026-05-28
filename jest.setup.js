// Jest setup file for ESM mocking
import { jest } from '@jest/globals';

// Mock node-tradfri-client globally before any tests
jest.mock('node-tradfri-client', () => ({
    discoverGateway: jest.fn(),
    TradfriClient: jest.fn()
}));

// Fail tests on undefined function/variable access
// Wrap console.error to catch ReferenceErrors and similar issues
// eslint-disable-next-line no-console
const originalError = console.error.bind(console);
// eslint-disable-next-line no-console
console.error = function(...args) {
    originalError(...args);
    
    for (const arg of args) {
        if (arg instanceof Error) {
            if (arg.name === 'ReferenceError' || 
                arg.message?.includes('is not defined') ||
                arg.message?.includes('Cannot read properties of undefined')) {
                throw arg;
            }
        } else if (typeof arg === 'string') {
            if (arg.includes('is not defined') || 
                arg.includes('Cannot read properties of undefined') ||
                arg.includes('ReferenceError')) {
                throw new Error(arg);
            }
        }
    }
};
