/**
 * Tests for state.js module
 */

import {
    getState,
    getStateValue,
    setStateValue,
    updateState,
    getSettings,
    updateSettings,
    resetState
} from '../state.js';

describe('State Management', () => {
    beforeEach(() => {
        // Reset state before each test
        resetState();
    });

    describe('getState', () => {
        it('should return the current state', () => {
            const state = getState();
            expect(state).toBeDefined();
            expect(state).toHaveProperty('firstRun');
            expect(state).toHaveProperty('gatewayAvailable');
            expect(state).toHaveProperty('mysettings');
        });

        it('should return a copy of the state, not the reference', () => {
            const state1 = getState();
            const state2 = getState();
            expect(state1).not.toBe(state2);
        });
    });

    describe('getStateValue', () => {
        it('should return the value for a valid key', () => {
            expect(getStateValue('firstRun')).toBe(true);
            expect(getStateValue('gatewayAvailable')).toBe(false);
        });

        it('should return undefined for invalid keys', () => {
            expect(getStateValue('nonExistentKey')).toBeUndefined();
        });
    });

    describe('setStateValue', () => {
        it('should set a state value', () => {
            setStateValue('firstRun', false);
            expect(getStateValue('firstRun')).toBe(false);
        });

        it('should not affect other state values', () => {
            const initialGatewayAvailable = getStateValue('gatewayAvailable');
            setStateValue('firstRun', false);
            expect(getStateValue('gatewayAvailable')).toBe(initialGatewayAvailable);
        });
    });

    describe('updateState', () => {
        it('should update multiple state values at once', () => {
            updateState({
                firstRun: false,
                gatewayAvailable: true,
                gatewayDiscovered: true
            });

            expect(getStateValue('firstRun')).toBe(false);
            expect(getStateValue('gatewayAvailable')).toBe(true);
            expect(getStateValue('gatewayDiscovered')).toBe(true);
        });
    });

    describe('getSettings', () => {
        it('should return the current settings', () => {
            const settings = getSettings();
            expect(settings).toBeDefined();
            expect(settings).toHaveProperty('zone');
            expect(settings).toHaveProperty('ikeaplug');
        });

        it('should return a copy of the settings, not the reference', () => {
            const settings1 = getSettings();
            const settings2 = getSettings();
            expect(settings1).not.toBe(settings2);
        });
    });

    describe('updateSettings', () => {
        it('should update settings values', () => {
            updateSettings({
                zone: 'test-zone',
                ikeaplug: 'test-plug'
            });

            const settings = getSettings();
            expect(settings.zone).toBe('test-zone');
            expect(settings.ikeaplug).toBe('test-plug');
        });

        it('should preserve existing settings not being updated', () => {
            updateSettings({ zone: 'test-zone' });
            const settings = getSettings();
            expect(settings.zone).toBe('test-zone');
            expect(settings.ikeaplug).toBeNull();
        });
    });

    describe('resetState', () => {
        it('should reset all state to initial values', () => {
            // Modify some state
            setStateValue('firstRun', false);
            setStateValue('gatewayAvailable', true);
            updateSettings({ zone: 'modified' });

            // Reset
            resetState();

            // Check initial values are restored
            expect(getStateValue('firstRun')).toBe(true);
            expect(getStateValue('gatewayAvailable')).toBe(false);
            expect(getSettings().zone).toBeNull();
        });
    });

    describe('Constants', () => {
        it('should export constants', () => {
            const { GATEWAY_CHECK_INTERVAL_MS, MAX_DISCOVERY_ATTEMPTS } = require('../state.js');
            expect(GATEWAY_CHECK_INTERVAL_MS).toBe(60000);
            expect(MAX_DISCOVERY_ATTEMPTS).toBe(3);
        });
    });
});
