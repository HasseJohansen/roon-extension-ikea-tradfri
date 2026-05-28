/**
 * IKEA Tradfri Gateway Manager
 * Handles connection, device discovery, and device control
 */

import delay from 'delay';
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
            console.log("Tradfri connection cleaned up");
        } catch (e) {
            console.log("Error during tradfri cleanup:", e.message);
        }
        setStateValue('tradfri', null);
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
            // If we already have a connection, nothing to check
            if (getStateValue('gatewayAvailable') && getStateValue('tradfri')) {
                return;
            }

            // If gateway has been discovered before, try to reconnect
            if (getStateValue('gatewayDiscovered')) {
                console.log("Attempting to reconnect to previously discovered gateway...");
                setStateValue('ikeaDevices', []);
                const mysettings = getSettings();
                await getIkeaDevices(mysettings.ikeagwkey);
                return;
            }

            // Gateway not yet discovered - start discovery
            console.log("Starting gateway discovery...");
            await getIkeaDevices();
        } catch (err) {
            console.log("IKEA gateway check failed:", err && err.message ? err.message : err);
            updateState({
                gatewayAvailable: false,
                gatewayDiscovered: err.message && err.message.includes("Tradfri gateway not found") ? false : getStateValue('gatewayDiscovered')
            });
            // Clear connection state on any error
            await cleanupTradfriConnection();
            updateState({
                firstRun: true,
                ikeaDevices: []
            });
        }
    };

    // Initial check
    checkGateway();

    // Periodic check
    const timer = setInterval(checkGateway, GATEWAY_CHECK_INTERVAL_MS);
    console.log(`Started IKEA gateway monitor, checking every ${GATEWAY_CHECK_INTERVAL_MS / 1000} seconds`);
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
        console.log("Gateway discovery already in progress, skipping");
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
                console.log(`Tradfri gateway not found, retrying in ${delayMs / 1000} seconds (attempt ${attempt + 1}/${MAX_DISCOVERY_ATTEMPTS + 1})...`);
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
                console.log("Authentication failed - security code required");
            } else {
                console.log("IKEA gateway found but not connected (no credentials or connection failed)");
            }
        } else if (result && result.tradfri) {
            updateState({
                firstRun: false,
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
                console.log("Saved new Tradfri credentials to Roon config");
            }

            const tradfri = result.tradfri;
            tradfri.observeDevices();
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
        console.log("Error in get_ikea_devices after attempts:", err && err.message ? err.message : err);
        updateState({
            gatewayAvailable: false,
            firstRun: true
        });
        // Set auth_failed for authentication errors
        if (err.message && (err.message.includes("not valid") || err.message.includes("Authentication") || err.message.includes("re-authenticate"))) {
            updateState({
                authFailed: true,
                gatewayDiscovered: false
            });
            updateSettings({
                tradfri_identity: null,
                tradfri_psk: null
            });
            console.log("Authentication failed - cleared invalid credentials");
        }
        // Only set gateway_discovered to false if gateway is not on the network
        else if (err.message && err.message.includes("Tradfri gateway not found")) {
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
 */
export async function turnIkeaDevice(cmd, deviceid) {
    const tradfri = getStateValue('tradfri');
    if (!tradfri || !tradfri.devices) {
        console.log("Cannot turn device - tradfri not connected");
        return;
    }

    for (const deviceId in tradfri.devices) {
        if (deviceId === deviceid) {
            const device = tradfri.devices[deviceId];
            const accessory = device.plugList[0];
            accessory.client = tradfri;
            if (cmd === "ON") {
                accessory.turnOn();
            } else if (cmd === "OFF") {
                accessory.turnOff();
            }
        }
    }
}


