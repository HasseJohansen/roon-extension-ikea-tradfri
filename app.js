/**
 * Roon Extension for IKEA Tradfri
 * Main entry point - initializes Roon API and coordinates modules
 */

import fs from 'fs';
import RoonApi from "node-roon-api";
import RoonApiStatus from "node-roon-api-status";
import RoonApiTransport from "node-roon-api-transport";
import logger from './logger.js';

import {
    getStateValue,
    setStateValue,
    updateState,
    getSettings,
    updateSettings
} from './state.js';

import {
    cleanupTradfriConnection,
    startGatewayMonitor,
    stopGatewayMonitor,
    getIkeaDevices,
    turnIkeaDevice
} from './tradfri-manager.js';

import { createSettingsService, updateStatus } from './settings-manager.js';

// Load version from package.json - single source of truth
const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));

// Initialize Roon API
const roon = new RoonApi({
    extension_id: 'dk.1mx.roon-tradfri',
    display_name: 'Roon Tradfri',
    display_version: pkg.version,
    publisher: 'Hasse Hagen Johansen',
    email: 'hasse-roon@1mx.dk',
    website: 'https://github.com/HasseJohansen/roon-extension-ikea-tradfri',

    core_paired: function(core) {
        const transport = core.services.RoonApiTransport;
        transport.subscribe_zones(function(cmd, data) {
            if (cmd === "Changed") {
                if (data.zones_changed) {
                    data.zones_changed.forEach(zone => {
                        zone.outputs.forEach(output => {
                            if (output.output_id === getStateValue('outputId')) {
                                if (zone.state === "playing" || zone.state === "loading") {
                                    logger.info('Turning ON IKEA device');
                                    turnIkeaDevice("ON", getSettings().ikeaplug);
                                } else {
                                    logger.info('Turning OFF IKEA device');
                                    turnIkeaDevice("OFF", getSettings().ikeaplug);
                                }
                            }
                        });
                    });
                }
            }
        });
    },

    core_unpaired: async function(core) {
        logger.info(`${core.core_id}, ${core.display_name}, ${core.display_version}, - LOST`);
        // Cleanup resources when core is unpaired
        stopGatewayMonitor();
        await cleanupTradfriConnection();
    }
});

// Load saved settings from Roon config
const savedSettings = roon.load_config("settings") || {};
updateSettings(savedSettings);

// Initialize state from saved settings
if (savedSettings.outputid) {
    setStateValue('outputId', savedSettings.outputid.output_id);
}

// Create status service first (needed by settings service)
const svc_status = new RoonApiStatus(roon);

// Create settings service with access to status service
const svc_settings = createSettingsService(roon, svc_status);

// Initialize services
roon.init_services({
    required_services: [RoonApiTransport],
    provided_services: [svc_settings, svc_status]
});

// Restore persisted pairing state before discovery starts.
// Need to set BOTH paired_core_id AND is_paired for library to recognize reconnection.
const roonstate = roon.load_config("roonstate") || {};
if (roonstate.paired_core_id) {
    roon.paired_core_id = roonstate.paired_core_id;
    roon.paired_core = { core_id: roonstate.paired_core_id };
    roon.is_paired = true;
    logger.info(`[DIAG] Restored pairing state: ${roonstate.paired_core_id}, is_paired=true`);
}

// Set initial status before gateway discovery starts
updateStatus(svc_status);

// Global error handlers
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err && err.message ? err.message : err);
    // Try to recover by resetting state
    stopGatewayMonitor();
    setStateValue('gatewayDiscovering', false);
    cleanupTradfriConnection().catch(e => {
        logger.warn("Warning: Error during tradfri cleanup in uncaughtException:", e.message);
    });
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason && reason.message ? reason.message : reason);
});

// Start Roon discovery IMMEDIATELY - don't wait for Tradfri
// This ensures Roon connects as soon as possible, preventing authorization timeouts
initSignalHandlers();
roon.start_discovery();

// Start Tradfri discovery in parallel - it will auto-retry on failure
const mysettings = getSettings();
getIkeaDevices(mysettings.ikeagwkey).then(() => {
    updateStatus(svc_status);
}).catch(err => {
    logger.error('Tradfri discovery failed, will retry:', err && err.message ? err.message : err);
    updateState({
        gatewayAvailable: false,
        gatewayDiscovered: err.message && err.message.includes("Tradfri gateway not found") ? false : getStateValue('gatewayDiscovered')
    });
    updateStatus(svc_status);
});

// Start periodic gateway monitoring
startGatewayMonitor();

/**
 * Initialize signal handlers for graceful shutdown
 */
function initSignalHandlers() {
    const handle = function(signal) {
        logger.info(`Received ${signal}, shutting down gracefully...`);
        stopGatewayMonitor();
        cleanupTradfriConnection().then(() => {
            process.exit(0);
        }).catch(() => {
            process.exit(0);
        });
    };

    // Register signal handlers to enable a graceful stop of the container
    process.on('SIGTERM', handle);
    process.on('SIGINT', handle);
}

export default roon;
