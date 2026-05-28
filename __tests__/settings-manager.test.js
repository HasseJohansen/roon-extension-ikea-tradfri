/**
 * Tests for settings-manager.js module
 */

import { makeLayout } from '../settings-manager.js';
import {
    getStateValue,
    setStateValue,
    updateState,
    resetState
} from '../state.js';

describe('Settings Manager', () => {
    beforeEach(() => {
        resetState();
    });

    describe('makeLayout', () => {
        it('should return a valid layout object', () => {
            const layout = makeLayout({});
            expect(layout).toBeDefined();
            expect(layout).toHaveProperty('values');
            expect(layout).toHaveProperty('layout');
            expect(layout).toHaveProperty('has_error');
        });

        it('should show security code input on first run', () => {
            setStateValue('firstRun', true);
            const layout = makeLayout({});

            expect(layout.has_error).toBe(false);
            expect(layout.layout.length).toBeGreaterThan(0);
            expect(layout.layout[0].type).toBe('string');
            expect(layout.layout[0].setting).toBe('ikeagwkey');
        });

        it('should show authentication failed message when authFailed is true', () => {
            setStateValue('firstRun', true);
            setStateValue('authFailed', true);
            const layout = makeLayout({});

            expect(layout.layout[0].title).toContain('Authentication failed');
        });

        it('should show zone and device dropdown when not first run', () => {
            setStateValue('firstRun', false);
            setStateValue('gatewayDiscovered', true);
            setStateValue('ikeaDevices', [
                { title: 'Device 1', value: 'device1' },
                { title: 'Device 2', value: 'device2' }
            ]);

            const layout = makeLayout({});

            expect(layout.has_error).toBe(false);
            // Should have zone selector
            const zoneField = layout.layout.find(f => f.setting === 'outputid');
            expect(zoneField).toBeDefined();
            expect(zoneField.type).toBe('zone');

            // Should have device dropdown
            const deviceField = layout.layout.find(f => f.setting === 'ikeaplug');
            expect(deviceField).toBeDefined();
            expect(deviceField.type).toBe('dropdown');
            expect(deviceField.values).toHaveLength(2);
        });

        it('should show message when no devices available', () => {
            setStateValue('firstRun', false);
            setStateValue('gatewayDiscovered', true);
            setStateValue('ikeaDevices', []);

            const layout = makeLayout({});

            const deviceMsg = layout.layout.find(f => f.setting === 'no_devices_msg');
            expect(deviceMsg).toBeDefined();
            expect(deviceMsg.title).toContain('No IKEA devices found');
            expect(deviceMsg.readonly).toBe(true);
        });

        it('should handle errors gracefully', () => {
            // Mock console.log to check error logging
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            // Force an error by passing null
            const layout = makeLayout(null);

            expect(layout.has_error).toBe(true);
            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });
    });
});
