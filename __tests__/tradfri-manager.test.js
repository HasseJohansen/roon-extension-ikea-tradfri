/**
 * Tests for tradfri-manager.js module
 */

import { jest } from '@jest/globals';
import {
    cleanupTradfriConnection,
    stopGatewayMonitor,
    turnIkeaDevice
} from '../tradfri-manager.js';
import {
    getStateValue,
    setStateValue,
    updateState,
    resetState
} from '../state.js';

// Mock the IkeaConnection module
jest.mock('../connection.js', () => ({
    getConnection: jest.fn()
}));

describe('Tradfri Manager', () => {
    beforeEach(() => {
        resetState();
        jest.clearAllMocks();
    });

    describe('cleanupTradfriConnection', () => {
        it('should do nothing when tradfri is null', async () => {
            setStateValue('tradfri', null);
            await cleanupTradfriConnection();
            expect(getStateValue('tradfri')).toBeNull();
        });

        it('should cleanup tradfri connection when it exists', async () => {
            const mockTradfri = {
                destroy: jest.fn().mockResolvedValue(undefined)
            };
            setStateValue('tradfri', mockTradfri);

            await cleanupTradfriConnection();

            expect(mockTradfri.destroy).toHaveBeenCalled();
            expect(getStateValue('tradfri')).toBeNull();
        });

        it('should handle cleanup errors gracefully', async () => {
            const mockTradfri = {
                destroy: jest.fn().mockRejectedValue(new Error('Cleanup failed'))
            };
            setStateValue('tradfri', mockTradfri);

            // Should not throw
            await expect(cleanupTradfriConnection()).resolves.not.toThrow();
            expect(getStateValue('tradfri')).toBeNull();
        });
    });

    describe('stopGatewayMonitor', () => {
        it('should clear the gateway check timer', () => {
            const mockTimer = 123; // setInterval returns a number
            setStateValue('gatewayCheckTimer', mockTimer);
            const clearIntervalSpy = jest.spyOn(global, 'clearInterval').mockImplementation(() => {});

            stopGatewayMonitor();

            expect(clearIntervalSpy).toHaveBeenCalledWith(mockTimer);
            expect(getStateValue('gatewayCheckTimer')).toBeNull();

            clearIntervalSpy.mockRestore();
        });

        it('should do nothing when timer is null', () => {
            setStateValue('gatewayCheckTimer', null);
            stopGatewayMonitor();
            expect(getStateValue('gatewayCheckTimer')).toBeNull();
        });
    });

    describe('turnIkeaDevice', () => {
        it('should do nothing when tradfri is not connected', async () => {
            setStateValue('tradfri', null);
            await turnIkeaDevice('ON', 'device1');
            // Should not throw
        });

        it('should do nothing when tradfri.devices is not available', async () => {
            setStateValue('tradfri', { devices: null });
            await turnIkeaDevice('ON', 'device1');
            // Should not throw
        });

        it('should turn on device when found', async () => {
            const mockAccessory = {
                client: null,
                turnOn: jest.fn(),
                turnOff: jest.fn()
            };
            const mockDevice = {
                name: 'Test Device',
                plugList: [mockAccessory]
            };
            const mockTradfri = {
                devices: {
                    'device1': mockDevice
                }
            };
            setStateValue('tradfri', mockTradfri);

            await turnIkeaDevice('ON', 'device1');

            expect(mockAccessory.turnOn).toHaveBeenCalled();
            expect(mockAccessory.turnOff).not.toHaveBeenCalled();
        });

        it('should turn off device when found', async () => {
            const mockAccessory = {
                client: null,
                turnOn: jest.fn(),
                turnOff: jest.fn()
            };
            const mockDevice = {
                name: 'Test Device',
                plugList: [mockAccessory]
            };
            const mockTradfri = {
                devices: {
                    'device1': mockDevice
                }
            };
            setStateValue('tradfri', mockTradfri);

            await turnIkeaDevice('OFF', 'device1');

            expect(mockAccessory.turnOff).toHaveBeenCalled();
            expect(mockAccessory.turnOn).not.toHaveBeenCalled();
        });

        it('should do nothing when device is not found', async () => {
            const mockAccessory = {
                client: null,
                turnOn: jest.fn(),
                turnOff: jest.fn()
            };
            const mockDevice = {
                name: 'Test Device',
                plugList: [mockAccessory]
            };
            const mockTradfri = {
                devices: {
                    'device1': mockDevice
                }
            };
            setStateValue('tradfri', mockTradfri);

            await turnIkeaDevice('ON', 'device2'); // Non-existent device

            expect(mockAccessory.turnOn).not.toHaveBeenCalled();
            expect(mockAccessory.turnOff).not.toHaveBeenCalled();
        });
    });
});
