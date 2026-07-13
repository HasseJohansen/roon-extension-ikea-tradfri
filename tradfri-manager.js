/**
 * IKEA Tradfri Gateway Manager
 * Handles connection, device discovery, and device control
 */

import delay from 'delay';
import logger from './logger.js';
import IkeaConnection from './connection.js';
import {
    getStateValue,
    setStateValue,
    updateState,
    updateSettings,
    getSettings,
    GATEWAY_CHECK_INTERVAL_MS,
    MAX_DISCOVERY_ATTEMPTS,
    BASE_RETRY_DELAY_MS,
    MAX_RETRY_DELAY_MS
} from './state.js';

/**
 * Cleanup tradfri connection
 */
export async function cleanupTradfriConnection() {
    const tradfri = getStateValue('tradfri');
    if (tradfri) {
        try {
            await tradfri.destroy();
            logger.info("[DEVICE_CTRL] Tradfri connection cleaned up");
        } catch (e) {
            logger.error("[DEVICE_CTRL] Error during tradfri cleanup:", e && e.message ? e.message : JSON.stringify(e));
        }
        setStateValue('tradfri', null);
        // Reset device state when connection is cleaned up
        setStateValue('currentDeviceState', null);
        setStateValue('gatewayAvailable', false);
        setStateValue('gatewayDiscovered', false);
    }
}

/**
 * Start the gateway monitor
 */
export function startGatewayMonitor() {
    const checkGateway = async () => {
        // Skip if discovery already in progress
        if (getStateValue('gatewayDiscovering')) {
            return;
        }

        try {
            const tradfri = getStateValue('tradfri');
            const gatewayAvailable = getStateValue('gatewayAvailable');
            const gatewayDiscovered = getStateValue('gatewayDiscovered');

            // Log current state for debugging
            logger.info(`[GATEWAY] Checking gateway status: gatewayAvailable=${gatewayAvailable}, gatewayDiscovered=${gatewayDiscovered}, tradfri=${!!tradfri}`);

            // If we already have a connection, nothing to check
            if (gatewayAvailable && tradfri) {
                return;
            }

            // If gateway has been discovered before, try to reconnect
            if (gatewayDiscovered) {
                logger.info("[GATEWAY] Attempting to reconnect to previously discovered gateway...");
                setStateValue('ikeaDevices', []);
                setStateValue('currentDeviceState', null); // Reset device state on reconnection attempt
                const mysettings = getSettings();
                await getIkeaDevices(mysettings.ikeagwkey);
                return;
            }

            // Gateway not yet discovered - start discovery
            logger.info("[GATEWAY] Starting gateway discovery...");
            await getIkeaDevices();
        } catch (err) {
            logger.error("[GATEWAY] IKEA gateway check failed:", err && err.message ? err.message : JSON.stringify(err));
            updateState({
                gatewayAvailable: false,
                gatewayDiscovered: err.message && err.message.includes("Tradfri gateway not found") ? false : getStateValue('gatewayDiscovered')
            });
            // Clear connection state on any error
            await cleanupTradfriConnection();
            // Don't reset firstRun and ikeaDevices - preserve state for reconnection attempts
        }
    };

    // Initial check
    checkGateway();

    // Periodic check
    const timer = setInterval(checkGateway, GATEWAY_CHECK_INTERVAL_MS);
    logger.info(`[GATEWAY] Started IKEA gateway monitor, checking every ${GATEWAY_CHECK_INTERVAL_MS / 1000} seconds`);
    setStateValue('gatewayCheckTimer', timer);
}

/**
 * Stop the gateway monitor
 */
export function stopGatewayMonitor() {
    const timer = getStateValue('gatewayCheckTimer');
    if (timer) {
        clearInterval(timer);
        setStateValue('gatewayCheckTimer', null);
    }
}

/**
 * Get IKEA devices from the gateway
 * @param {string} gwkey - Security code (optional)
 */
export async function getIkeaDevices(gwkey = "undefined") {
    // Prevent concurrent discovery attempts
    if (getStateValue('gatewayDiscovering')) {
        logger.info("Gateway discovery already in progress, skipping");
        return;
    }

    updateState({
        gatewayDiscovering: true,
        ikeaDevices: []
    });

    try {
        // Clean up any existing connection before creating a new one
        await cleanupTradfriConnection();

        // Quick retry loop - don't block check_gateway for long
        let result;
        const mysettings = getSettings();

        for (let attempt = 0; attempt <= MAX_DISCOVERY_ATTEMPTS; attempt++) {
            try {
                // Pass cached credentials from Roon config
                result = await IkeaConnection.getConnection(
                    gwkey !== "undefined" ? gwkey : undefined,
                    mysettings.tradfri_identity,
                    mysettings.tradfri_psk
                );
                // Connection attempt succeeded (may have returned false if no credentials)
                break;
            } catch (err) {
                if (attempt >= MAX_DISCOVERY_ATTEMPTS) {
                    throw err; // Re-throw if we've exhausted attempts
                }
                // Short exponential backoff for quick attempts
                const delayMs = Math.min(BASE_RETRY_DELAY_MS * Math.pow(2, attempt), MAX_RETRY_DELAY_MS);
                logger.info(`Tradfri gateway not found, retrying in ${delayMs / 1000} seconds (attempt ${attempt + 1}/${MAX_DISCOVERY_ATTEMPTS + 1})...`);
                await delay(delayMs);
            }
        }

        // Handle connection result
        if (typeof result !== "object" || result === false) {
            updateState({
                firstRun: true,
                gatewayAvailable: false
            });
            // Gateway was found on network but connection failed (likely no/stored credentials)
            if (result === false) {
                // getConnection returned false - authentication failed or no credentials
                updateState({
                    authFailed: true,
                    gatewayDiscovered: true // Gateway was found via bonjour
                });
                logger.info("[CONNECTION] Authentication failed - security code required");
            } else {
                logger.info("[CONNECTION] IKEA gateway found but not connected (no credentials or connection failed)");
            }
        } else if (result && result.tradfri) {
            updateState({
                firstRun: false,
                authFailed: false,
                gatewayAvailable: true,
                gatewayDiscovered: true,
                tradfri: result.tradfri
            });

            // Save new credentials if they're from a fresh authentication
            if (!result.usedCached && result.identity && result.psk) {
                updateSettings({
                    tradfri_identity: result.identity,
                    tradfri_psk: result.psk
                });
                // Now we have proper credentials, can delete the security code
                const newSettings = getSettings();
                delete newSettings.ikeagwkey;
                updateSettings(newSettings);
                logger.info("Saved new Tradfri credentials to Roon config");
            }

            const tradfri = result.tradfri;
            await tradfri.observeDevices();
            await delay(5000);

            const devices = [];
            for (const deviceId in tradfri.devices) {
                const device = tradfri.devices[deviceId];
                const deviceObj = {
                    title: device.name,
                    value: deviceId
                };
                if (typeof device.plugList !== "undefined") {
                    devices.push(deviceObj);
                }
            }
            setStateValue('ikeaDevices', devices);
        }
    } catch (err) {
        const errorMessage = err && err.message ? err.message : JSON.stringify(err);
        logger.error("[CONNECTION] Error in get_ikea_devices after attempts:", errorMessage);
        updateState({
            gatewayAvailable: false,
            firstRun: true
        });
        // Set auth_failed for authentication errors
        if (errorMessage && (errorMessage.includes("not valid") || errorMessage.includes("Authentication") || errorMessage.includes("re-authenticate"))) {
            updateState({
                authFailed: true,
                gatewayDiscovered: false
            });
            updateSettings({
                tradfri_identity: null,
                tradfri_psk: null
            });
            logger.info("[CONNECTION] Authentication failed - cleared invalid credentials");
        }
        // Only set gateway_discovered to false if gateway is not on the network
        else if (errorMessage && errorMessage.includes("Tradfri gateway not found")) {
            updateState({ gatewayDiscovered: false });
        }
    } finally {
        setStateValue('gatewayDiscovering', false);
    }
}

/**
 * Turn an IKEA device on or off
 * @param {string} cmd - "ON" or "OFF"
 * @param {string} deviceid - Device ID
 * @returns {Promise<boolean>} - true if successful, false if failed
 */
/**
 * Get current device state
 * @returns {string|null} Current state: 'ON', 'OFF', or null (unknown/initial)
 */
export function getCurrentDeviceState() {
    return getStateValue('currentDeviceState');
}

/**
 * Set current device state (for external control or testing)
 * @param {string|null} state - 'ON', 'OFF', or null to reset
 */
export function setCurrentDeviceState(state) {
    if (state === 'ON' || state === 'OFF' || state === null) {
        setStateValue('currentDeviceState', state);
    } else {
        logger.warn(`Invalid device state: ${state}, must be 'ON', 'OFF', or null`);
    }
}

/**
 * Check if Tradfri connection is active and ready
 * @returns {boolean} True if connected and devices are loaded
 */
export function isTradfriConnected() {
    const tradfri = getStateValue('tradfri');
    const gatewayAvailable = getStateValue('gatewayAvailable');
    
    if (!gatewayAvailable) {
        return false;
    }
    
    return tradfri && tradfri.devices && Object.keys(tradfri.devices).length > 0;
}

/**
 * Attempt to reconnect to Tradfri gateway when connection is lost
 * @returns {Promise<boolean>} True if reconnection succeeded
 */
export async function reconnectTradfri() {
    const gatewayDiscovered = getStateValue('gatewayDiscovered');
    
    if (!gatewayDiscovered) {
        logger.warn("[DEVICE_CTRL] Cannot reconnect - gateway not yet discovered");
        return false;
    }
    
    logger.info("[DEVICE_CTRL] Attempting to reconnect to Tradfri gateway...");
    const mysettings = getSettings();
    
    try {
        await getIkeaDevices(mysettings.ikeagwkey);
        const connected = isTradfriConnected();
        if (connected) {
            logger.info("[DEVICE_CTRL] Successfully reconnected to Tradfri gateway");
        } else {
            logger.warn("[DEVICE_CTRL] Reconnection failed - Tradfri not connected");
        }
        return connected;
    } catch (err) {
        const errorMessage = err && err.message ? err.message : JSON.stringify(err);
        logger.error("[DEVICE_CTRL] Reconnection failed:", errorMessage);
        return false;
    }
}

export async function turnIkeaDevice(cmd, deviceid) {
    const tradfri = getStateValue('tradfri');
    const currentState = getStateValue('currentDeviceState');
    const gatewayAvailable = getStateValue('gatewayAvailable');
    
    // Detailed logging for debugging
    const deviceCount = tradfri && tradfri.devices ? Object.keys(tradfri.devices).length : 0;
    logger.info(`[DEVICE_CTRL] turnIkeaDevice: cmd=${cmd}, deviceid=${deviceid}, currentState=${currentState}, gatewayAvailable=${gatewayAvailable}, deviceCount=${deviceCount}`);
    
    // If already in desired state, skip to avoid redundant commands
    if (currentState === cmd) {
        logger.info(`[DEVICE_CTRL] Device already ${cmd}, skipping command for device ${deviceid}`);
        return true;
    }
    
    // Check if Tradfri is connected and ready
    if (!isTradfriConnected()) {
        logger.warn(`[DEVICE_CTRL] Cannot turn device - Tradfri not connected or devices not loaded (gatewayAvailable=${gatewayAvailable}, tradfri=${!!tradfri}, deviceCount=${deviceCount})`);
        // Attempt to reconnect
        const reconnected = await reconnectTradfri();
        if (!reconnected) {
            return false;
        }
        // After reconnection, re-check if we're connected
        if (!isTradfriConnected()) {
            logger.error(`[DEVICE_CTRL] Reconnection succeeded but still not connected`);
            return false;
        }
    }

    try {
        const updatedTradfri = getStateValue('tradfri');
        
        for (const deviceId in updatedTradfri.devices) {
            if (deviceId === deviceid) {
                const device = updatedTradfri.devices[deviceId];
                const accessory = device.plugList[0];
                
                if (!accessory) {
                    logger.error(`[DEVICE_CTRL] Device ${deviceid} has no plugList`);
                    return false;
                }
                
                accessory.client = updatedTradfri;
                
                if (cmd === "ON") {
                    logger.info(`[DEVICE_CTRL] Attempting to turn ON device ${deviceid}`);
                    await accessory.turnOn();
                    setStateValue('currentDeviceState', 'ON');
                    logger.info(`[DEVICE_CTRL] Successfully turned ON device ${deviceid}`);
                    return true;
                } else if (cmd === "OFF") {
                    logger.info(`[DEVICE_CTRL] Attempting to turn OFF device ${deviceid}`);
                    await accessory.turnOff();
                    setStateValue('currentDeviceState', 'OFF');
                    logger.info(`[DEVICE_CTRL] Successfully turned OFF device ${deviceid}`);
                    return true;
                }
            }
        }
        logger.warn(`[DEVICE_CTRL] Device ${deviceid} not found in tradfri devices`);
        return false;
    } catch (err) {
        // Enhanced error logging - capture full error object
        const errorDetails = err && err.message ? err.message : JSON.stringify(err);
        logger.error(`[DEVICE_CTRL] Error turning device ${deviceid} ${cmd}: ${errorDetails}`, { error: err });
        
        // On connection errors, clear the connection state to trigger reconnection on next attempt
        if (errorDetails.includes('ECONNREFUSED') || errorDetails.includes('not connected') || 
            errorDetails.includes('timeout') || errorDetails.includes('ECONNRESET')) {
            logger.warn(`[DEVICE_CTRL] Connection error detected, clearing connection state`);
            updateState({
                gatewayAvailable: false
            });
            setStateValue('currentDeviceState', null);
            // Cleanup will be handled by the gateway monitor
        }
        
        return false;
    }
}


