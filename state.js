/**
 * State management for Roon Tradfri extension
 * Encapsulates all mutable state in a single, testable module
 */

// Initial state
const initialState = {
    outputId: "",
    ikeaDevices: [],
    tradfri: null,
    firstRun: true,
    gatewayAvailable: false,
    gatewayDiscovered: false,
    authFailed: false,
    gatewayCheckTimer: null,
    gatewayDiscovering: false,
    mysettings: {
        zone: null,
        ikeaplug: null,
        tradfri_identity: null,
        tradfri_psk: null
    }
};

// Mutable state object
const state = { ...initialState };

// Constants
const GATEWAY_CHECK_INTERVAL_MS = 60000; // Check every 60 seconds
const MAX_DISCOVERY_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 2000; // 2 seconds
const MAX_RETRY_DELAY_MS = 10000; // 10 seconds

/**
 * Get current state
 * @returns {Object} Current state
 */
export function getState() {
    return { ...state };
}

/**
 * Get a specific state value
 * @param {string} key - State key
 * @returns {*} State value
 */
export function getStateValue(key) {
    return state[key];
}

/**
 * Set a specific state value
 * @param {string} key - State key
 * @param {*} value - New value
 */
export function setStateValue(key, value) {
    state[key] = value;
}

/**
 * Update multiple state values at once
 * @param {Object} updates - Object with key-value pairs to update
 */
export function updateState(updates) {
    Object.assign(state, updates);
}

/**
 * Reset state to initial values
 */
export function resetState() {
    Object.assign(state, initialState);
}

/**
 * Get settings
 * @returns {Object} Current settings
 */
export function getSettings() {
    return { ...state.mysettings };
}

/**
 * Update settings
 * @param {Object} updates - Settings to update
 */
export function updateSettings(updates) {
    state.mysettings = { ...state.mysettings, ...updates };
}

// Export constants
export { GATEWAY_CHECK_INTERVAL_MS, MAX_DISCOVERY_ATTEMPTS, BASE_RETRY_DELAY_MS, MAX_RETRY_DELAY_MS };

export default state;
