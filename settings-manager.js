/**
 * Settings Manager for Roon Tradfri extension
 * Handles settings UI layout and validation
 */

import {
    getStateValue,
    setStateValue,
    getSettings as getStateSettings,
    updateSettings as updateStateSettings
} from './state.js';
import { getIkeaDevices } from './tradfri-manager.js';
import logger from './logger.js';
import RoonApiSettings from 'node-roon-api-settings';

/**
 * Create settings layout based on current state
 * @param {Object} settings - Current settings values
 * @returns {Object} Settings layout object
 */
export function makeLayout(settings) {
    try {
        const l = {
            values: settings || {},
            layout: [],
            has_error: false
        };

        const firstRun = getStateValue('firstRun');
        const authFailed = getStateValue('authFailed');
        const ikeaDevices = getStateValue('ikeaDevices');

        if (firstRun === true) {
            // Don't log during first run (settings input)
            // If auth failed, show error message
            if (authFailed) {
                l.layout.push({
                    type: "string",
                    title: "Authentication failed. Please re-enter security code(bottom of gateway)",
                    setting: "ikeagwkey",
                });
            } else {
                l.layout.push({
                    type: "string",
                    title: "Input security code(bottom of gateway)",
                    setting: "ikeagwkey",
                });
            }
        } else {
            // Remove security code from values after first run
            delete l.values.ikeagwkey;

            l.layout.push({
                type: "zone",
                title: "Zone",
                setting: "outputid",
            });

            // If no devices available (gateway off), show message instead of empty dropdown
            if (!ikeaDevices || ikeaDevices.length === 0) {
                l.layout.push({
                    type: "string",
                    title: "No IKEA devices found - gateway may be offline",
                    setting: "no_devices_msg",
                    readonly: true
                });
            } else {
                l.layout.push({
                    type: "dropdown",
                    title: "IkeaPlug",
                    values: ikeaDevices,
                    setting: "ikeaplug",
                });
            }
        }

        return l;
    } catch (err) {
        logger.info("Error in makeLayout:", err && err.message ? err.message : err);
        return {
            values: {},
            layout: [{
                type: "string",
                title: "Error: " + (err && err.message ? err.message : "Unknown error"),
                readonly: true
            }],
            has_error: true
        };
    }
}

/**
 * Get settings handler for Roon API
 * @param {Object} roon - Roon API instance
 * @returns {Object} Settings service configuration
 */
export function createSettingsService(roon) {
    return new RoonApiSettings(roon, {
        get_settings: function(cb) {
            try {
                const authFailed = getStateValue('authFailed');
                const gatewayDiscovered = getStateValue('gatewayDiscovered');

                // If authentication failed, force first_run mode to allow re-entry of security code
                if (authFailed) {
                    setStateValue('firstRun', true);
                }

                if (!gatewayDiscovered) {
                    // If auth failed, show security code field instead of error
                    if (authFailed) {
                        cb(makeLayout(getStateSettings() || {}));
                    } else {
                        // Return a minimal valid layout - empty settings
                        cb({
                            values: {},
                            layout: [],
                            has_error: true,
                            error: "IKEA gateway not found"
                        });
                    }
                    return;
                }

                // If gateway was discovered but auth failed, force first_run to show security code field
                // Also force first_run if gateway not available and no security code
                const mysettings = getStateSettings();
                if ((!getStateValue('gatewayAvailable') && !mysettings.ikeagwkey) || authFailed) {
                    setStateValue('firstRun', true);
                }

                cb(makeLayout(mysettings || {}));
            } catch (err) {
                logger.info("Error in get_settings:", err && err.message ? err.message : err);
                cb({
                    values: {},
                    layout: [],
                    has_error: true,
                    error: "Error: " + (err && err.message ? err.message : "Unknown error")
                });
            }
        },

        save_settings: async function(req, isdryrun, settings) {
            try {
                const gatewayDiscovered = getStateValue('gatewayDiscovered');

                // Only block if gateway not discovered AND no security code to process
                if (!gatewayDiscovered) {
                    // Check if user is submitting a security code
                    const hasSecurityCode = settings && settings.values && settings.values.ikeagwkey;
                    if (!hasSecurityCode) {
                        req.send_complete("NotValid", { settings: {
                            values: getStateSettings() || {},
                            layout: [{
                                type: "string",
                                title: "IKEA gw not found",
                                readonly: true
                            }],
                            has_error: true
                        } });
                        return;
                    }
                    // User is submitting security code - allow it
                }

                // Force first_run mode if gateway not available to prevent crashes
                if (!getStateValue('gatewayAvailable')) {
                    setStateValue('firstRun', true);
                }

                if (req.body.settings) {
                    if (req.body.settings.values["outputid"] && getStateValue('firstRun') === false) {
                        setStateValue('outputId', req.body.settings.values["outputid"].output_id);
                    }
                }

                const l = makeLayout(settings.values);
                req.send_complete(l.has_error ? "NotValid" : "Success", { settings: l });

                if (!l.has_error && getStateValue('firstRun') === false) {
                    // Keep ikeagwkey in memory for reconnection attempts
                    // It will be deleted after successful Tradfri authentication
                    updateStateSettings(l.values);
                    // Save to Roon config
                    roon.save_config("settings", getStateSettings());
                } else {
                    setStateValue('firstRun', false);
                    setStateValue('authFailed', false); // Clear auth failure flag when user tries again

                    // Save the security code to settings for reconnection attempts
                    if (settings && settings.values && settings.values.ikeagwkey) {
                        updateStateSettings({ ikeagwkey: settings.values.ikeagwkey });
                    }

                    const gwkey = settings && settings.values ? settings.values.ikeagwkey : undefined;
                    await getIkeaDevices(gwkey).then(() => {
                        // Connection succeeded - update state and refresh UI
                        setStateValue('firstRun', false);
                        setStateValue('authFailed', false);
                        setStateValue('gatewayDiscovered', true);
                        setStateValue('gatewayAvailable', true);

                        // Force UI refresh by updating settings
                        updateStateSettings(l.values);
                    }).catch(err => {
                        logger.info('Failed to connect to gateway:', err && err.message ? err.message : err);
                        // Connection failed - set auth_failed so user can retry with new security code
                        setStateValue('firstRun', true);
                        setStateValue('authFailed', true);
                        setStateValue('gatewayAvailable', false);
                        setStateValue('gatewayDiscovered', false);
                    });
                }
            } catch (err) {
                logger.info("Error in save_settings:", err && err.message ? err.message : err);
                req.send_complete("NotValid", { settings: {
                    values: {},
                    layout: [{
                        type: "string",
                        title: "Error: " + (err && err.message ? err.message : "Unknown error"),
                        readonly: true
                    }],
                    has_error: true
                } });
            }
        }
    });
}

/**
 * Update status based on current state
 * @param {Object} svc_status - Roon status service
 */
export function updateStatus(svc_status) {
    try {
        const authFailed = getStateValue('authFailed');
        const gatewayDiscovered = getStateValue('gatewayDiscovered');
        const mysettings = getStateSettings();
        const ikeaDevices = getStateValue('ikeaDevices');

        if (authFailed) {
            svc_status.set_status("Authentication failed. Please re-enter security code");
        } else if (!gatewayDiscovered) {
            svc_status.set_status("IKEA gw not found");
        } else if (typeof mysettings.outputid !== "undefined" && mysettings.ikeaplug !== null) {
            const deviceName = (ikeaDevices || []).find(device => device.value === mysettings.ikeaplug);
            if (deviceName && deviceName.title) {
                svc_status.set_status(mysettings.outputid.name + " set to: " + deviceName.title, false);
            } else {
                svc_status.set_status("Configured but device not found");
            }
        } else {
            svc_status.set_status("First run. Please update settings");
        }
    } catch (err) {
        logger.info("Error in updateStatus:", err && err.message ? err.message : err);
        svc_status.set_status("Error: " + (err && err.message ? err.message : "Unknown error"));
    }
}

export default {
    makeLayout,
    createSettingsService,
    updateStatus
};
