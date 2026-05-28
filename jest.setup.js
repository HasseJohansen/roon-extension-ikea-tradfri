// Jest setup file for ESM mocking
import { jest } from '@jest/globals';

// Mock node-tradfri-client globally before any tests
jest.mock('node-tradfri-client', () => ({
    discoverGateway: jest.fn(),
    TradfriClient: jest.fn()
}));
