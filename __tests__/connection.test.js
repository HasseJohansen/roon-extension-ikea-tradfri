/**
 * Tests for connection.js module
 * Note: These tests mock the network calls since we can't test actual gateway discovery
 */

import { jest } from '@jest/globals';
import { discoverGateway, TradfriClient } from 'node-tradfri-client';
import IkeaConnection from '../connection.js';

describe('Connection', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        TradfriClient.mockImplementation(() => ({
            authenticate: jest.fn(),
            connect: jest.fn()
        }));
    });

    describe('getConnection', () => {
        it('should throw error when gateway is not found', async () => {
            discoverGateway.mockResolvedValue(null);

            await expect(IkeaConnection.getConnection()).rejects.toThrow('Tradfri gateway not found');
        });

        it('should throw error when gateway discovery fails', async () => {
            discoverGateway.mockRejectedValue(new Error('Discovery failed'));

            await expect(IkeaConnection.getConnection()).rejects.toThrow('Discovery failed');
        });

        it('should attempt connection with cached credentials when provided', async () => {
            const mockGateway = { host: '192.168.1.100', addresses: ['192.168.1.100'] };
            const mockConnect = jest.fn().mockResolvedValue(undefined);

            discoverGateway.mockResolvedValue(mockGateway);
            TradfriClient.mockImplementation(() => ({
                connect: mockConnect
            }));

            await IkeaConnection.getConnection(undefined, 'test-identity', 'test-psk');

            expect(mockConnect).toHaveBeenCalledWith('test-identity', 'test-psk');
        });

        it('should use security code when no cached credentials', async () => {
            const mockGateway = { host: '192.168.1.100', addresses: ['192.168.1.100'] };
            const mockAuthenticate = jest.fn().mockResolvedValue({ identity: 'new-identity', psk: 'new-psk' });
            const mockConnect = jest.fn().mockResolvedValue(undefined);

            discoverGateway.mockResolvedValue(mockGateway);
            TradfriClient.mockImplementation(() => ({
                authenticate: mockAuthenticate,
                connect: mockConnect
            }));

            const result = await IkeaConnection.getConnection('test-code');

            expect(mockAuthenticate).toHaveBeenCalledWith('test-code');
            expect(mockConnect).toHaveBeenCalledWith('new-identity', 'new-psk');
            expect(result.tradfri).toBeDefined();
            expect(result.identity).toBe('new-identity');
            expect(result.psk).toBe('new-psk');
            expect(result.usedCached).toBe(false);
        });

        it('should return false when no valid credentials available', async () => {
            const mockGateway = { host: '192.168.1.100', addresses: ['192.168.1.100'] };
            const mockConnect = jest.fn().mockRejectedValue(new Error('Connection failed'));

            discoverGateway.mockResolvedValue(mockGateway);
            TradfriClient.mockImplementation(() => ({
                connect: mockConnect
            }));

            const result = await IkeaConnection.getConnection();

            expect(result).toBe(false);
        });
    });
});
