import delay from 'delay';
import RoonApi from "node-roon-api"
import RoonApiStatus from "node-roon-api-status"
import RoonApiTransport from "node-roon-api-transport"
import RoonApiSettings from 'node-roon-api-settings'
import IkeaConnection from './connection.js' 
import IkeaDevices from './devices.js' 
import fs from 'fs'

// Load version from package.json - single source of truth
const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));

var _output_id = "";
var ikea_devices = new Array;
var tradfri
var first_run = false
var gateway_available = false
var gateway_discovered = false
var gateway_check_timer = null
var gateway_discovering = false
const GATEWAY_CHECK_INTERVAL_MS = 60000 // Check every 60 seconds

var roon = new RoonApi({
    extension_id:        'dk.1mx.roon-tradfri',
    display_name:        'Roon Tradfri',
    display_version:     pkg.version,
    publisher:           'Hasse Hagen Johansen',
    email:               'hasse-roon@1mx.dk',
    website:             'https://github.com/HasseJohansen/roon-extension-ikea-tradfri',

    core_paired: function(core) {
        let transport = core.services.RoonApiTransport;
        transport.subscribe_zones(function(cmd, data) {
            if (cmd == "Changed") {
                if (data.zones_changed) {
                    data.zones_changed.forEach(zone => {
                        zone.outputs.forEach(output => {
                            if (output.output_id == _mysettings.outputid.output_id) {
				if ((zone.state == "playing") || (zone.state == "loading")) {
				    console.log('Turning ON IKEA device');
				    turn_ikea_device("ON", _mysettings.ikeaplug)
				}
				else {
				    console.log('Turning OFF IKEA device');
				    turn_ikea_device("OFF", _mysettings.ikeaplug)
				}
                            }
                        });
                    });
                }    
            }
        });
    },

    core_unpaired: function(core) {
        console.log(core.core_id,
		    core.display_name,
		    core.display_version,
		    "-",
		    "LOST");
    }
});

var _mysettings = Object.assign({
    zone:             null,
    ikeaplug:         null
}, roon.load_config("settings") || {});

function makelayout(settings) {
    try {
        var l = {
                 values:    settings || {},
                 layout:    [],
                 has_error: false
        };
        if( first_run == true ) {
	    do_not_log()
            l.layout.push({
	        type: "string",
	        title: "Input security code(bottom of gateway)",
	        setting: "ikeagwkey",
	    })
        }
        else {
            delete l.values.ikeagwkey;
	    log()
            l.layout.push({
                type:    "zone",
                title:   "Zone",
                setting: "outputid",
            });
            
            // If no devices available (gateway off), show message instead of empty dropdown
            if (!ikea_devices || ikea_devices.length === 0) {
                l.layout.push({
                    type: "string",
                    title: "No IKEA devices found - gateway may be offline",
                    setting: "no_devices_msg",
                    readonly: true
                });
            } else {
                l.layout.push({
                    type:    "dropdown",
                    title:   "IkeaPlug",
                    values:  ikea_devices,
                    setting: "ikeaplug",
                });
            }
        }
        return l;
    } catch (err) {
        console.log("Error in makelayout:", err && err.message ? err.message : err);
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

var svc_settings = new RoonApiSettings(roon, {
        get_settings: function(cb) {
            try {
                if (!gateway_discovered) {
                    // Return a minimal valid layout - empty settings
                    cb({
                        values: {},
                        layout: [],
                        has_error: true,
                        error: "IKEA gateway not found"
                    });
                    return;
                }
                // If gateway was discovered but not available, force first_run mode
                // This prevents crashes when gateway is off after being connected
                if (!gateway_available) {
                    first_run = true;
                }
                cb(makelayout(_mysettings || {}));
            } catch (err) {
                console.log("Error in get_settings:", err && err.message ? err.message : err);
                cb({
                    values: {},
                    layout: [],
                    has_error: true,
                    error: "Error: " + (err && err.message ? err.message : "Unknown error")
                });
            }
    },
    save_settings: function(req, isdryrun, settings) {
        try {
            if (!gateway_discovered) {
                req.send_complete("NotValid", { settings: {
                    values: _mysettings || {},
                    layout: [{
                        type: "string",
                        title: "IKEA gw not found",
                        readonly: true
                    }],
                    has_error: true
                } });
                return;
            }
            // Force first_run mode if gateway not available to prevent crashes
            if (!gateway_available) {
                first_run = true;
            }
            
            if (req.body.settings) {
                if ( (req.body.settings.values["outputid"]) && (first_run == false) ) {
                    _output_id = req.body.settings.values["outputid"]["output_id"];
                }
            }

            let l = makelayout(settings.values);
            req.send_complete(l.has_error ? "NotValid" : "Success", { settings: l });

            if (!l.has_error && first_run == false) {
	        delete l.values.ikeagwkey;
	        _mysettings = l.values;
                svc_settings.update_settings(l);
                roon.save_config("settings", _mysettings);
	        update_status();
            }
	    else {
	        first_run = false;
	        get_ikea_devices(l.values['ikeagwkey']).then( () => {
		    // Connection succeeded, refresh settings to show devices
		    first_run = false;
		    svc_status.set_status("Not Configured");
	        }).catch(err => {
		    console.log('Failed to connect to gateway:', err && err.message ? err.message : err);
		    // Connection failed - leave first_run as true so user can retry
		    first_run = true;
		    gateway_available = false;
		    update_status();
	        });
	    }
        } catch (err) {
            console.log("Error in save_settings:", err && err.message ? err.message : err);
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

var svc_status = new RoonApiStatus(roon);

roon.init_services({
    required_services: [ RoonApiTransport ],
    provided_services: [ svc_settings, svc_status ]
});

// Restore persisted pairing state before discovery starts.
// This matches the fix from commit b1cc0e3 which worked before.
// Need to set BOTH paired_core_id AND is_paired for library to recognize reconnection.
let roonstate = roon.load_config("roonstate") || {};
if (roonstate.paired_core_id) {
    roon.paired_core_id = roonstate.paired_core_id;
    roon.paired_core = { core_id: roonstate.paired_core_id };
    roon.is_paired = true;
    console.log(`[DIAG] Restored pairing state: ${roonstate.paired_core_id}, is_paired=true`);
}
// With token rotation prevented, Roon should recognize the extension across restarts.

function update_status() {
    try {
        if (!gateway_discovered) {
            svc_status.set_status("IKEA gw not found");
        }
        else if ( (typeof(_mysettings.outputid) != "undefined") && (_mysettings.ikeaplug != null) ) {
            var device_name = (ikea_devices || []).filter(device => {
	        return device.value === _mysettings.ikeaplug
            })[0]
            if (device_name && device_name.title) {
                svc_status.set_status(_mysettings.outputid.name + " set to: " + device_name.title, false);
            } else {
                svc_status.set_status("Configured but device not found");
            }
        }
        else {
	    svc_status.set_status("First run. Please update settings");
        }
    } catch (err) {
        console.log("Error in update_status:", err && err.message ? err.message : err);
        svc_status.set_status("Error: " + (err && err.message ? err.message : "Unknown error"));
    }
}

const check_gateway = async () => {
    // Skip if discovery already in progress
    if (gateway_discovering) {
        return;
    }
    
    try {
        // If we already have a connection, nothing to check
        if (gateway_available && tradfri) {
            return;
        }
        
        // If gateway has been discovered before, try to reconnect
        if (gateway_discovered) {
            console.log("Attempting to reconnect to previously discovered gateway...");
            ikea_devices = new Array();
            await get_ikea_devices();
            update_status();
            return;
        }
        
        // Gateway not yet discovered - start discovery
        console.log("Starting gateway discovery...");
        await get_ikea_devices();
        update_status();
    } catch (err) {
        console.log("IKEA gateway check failed:", err && err.message ? err.message : err);
        gateway_available = false;
        if (err.message && err.message.includes("Tradfri gateway not found")) {
            gateway_discovered = false;
        }
        // Clear connection state on any error
        if (tradfri) {
            try {
                await tradfri.destroy();
            } catch (e) {}
            tradfri = null;
        }
        first_run = true;
        ikea_devices = new Array();
        update_status();
    }
}

const start_gateway_monitor = () => {
    // Initial check
    check_gateway();
    // Periodic check
    gateway_check_timer = setInterval(check_gateway, GATEWAY_CHECK_INTERVAL_MS);
    console.log(`Started IKEA gateway monitor, checking every ${GATEWAY_CHECK_INTERVAL_MS / 1000} seconds`);
}

const stop_gateway_monitor = () => {
    if (gateway_check_timer) {
        clearInterval(gateway_check_timer);
        gateway_check_timer = null;
    }
}

const MAX_DISCOVERY_ATTEMPTS = 3; // Quick attempts, then let check_gateway retry
const BASE_RETRY_DELAY_MS = 2000; // 2 seconds
const MAX_RETRY_DELAY_MS = 10000; // 10 seconds

const get_ikea_devices = async (gwkey="undefined") => {
    // Prevent concurrent discovery attempts
    if (gateway_discovering) {
        console.log("Gateway discovery already in progress, skipping");
        return;
    }
    
    gateway_discovering = true;
    
    try {
        // Clear devices before new discovery
        ikea_devices = new Array();
        
        // Clean up any existing connection before creating a new one
        // This prevents "network stack reset" errors from multiple connections
        if (tradfri) {
            try {
                await tradfri.destroy();
            } catch (e) {
                // Ignore errors during cleanup
            }
            tradfri = null;
        }
        
        // Quick retry loop - don't block check_gateway for long
        for (let attempt = 0; attempt <= MAX_DISCOVERY_ATTEMPTS; attempt++) {
            try {
                // If security code provided, use it directly. Otherwise try with stored credentials.
                if (gwkey != "undefined") {
                    tradfri = await IkeaConnection.getConnection(gwkey);
                } else {
                    tradfri = await IkeaConnection.getConnection();
                }
                
                // Connection attempt succeeded (may have returned false if no credentials)
                break;
            } catch (err) {
                if (attempt >= MAX_DISCOVERY_ATTEMPTS) {
                    throw err; // Re-throw if we've exhausted attempts
                }
                // Short exponential backoff for quick attempts
                const delayMs = Math.min(BASE_RETRY_DELAY_MS * Math.pow(2, attempt), MAX_RETRY_DELAY_MS);
                console.log(`Tradfri gateway not found, retrying in ${delayMs/1000} seconds (attempt ${attempt + 1}/${MAX_DISCOVERY_ATTEMPTS + 1})...`);
                await delay(delayMs);
            }
        }
        
        // Handle connection result
        if (typeof(tradfri) != "object") {
            first_run = true;
            gateway_available = false;
            // Gateway was found on network but connection failed (likely no/stored credentials)
            // This is different from "gateway not on network" error
            if (tradfri === false) {
                // getConnection returned false - gateway WAS discovered but no credentials
                gateway_discovered = true;
            }
            console.log("IKEA gateway found but not connected (no credentials or connection failed)");
        }
        else {
	    first_run = false;
	    gateway_available = true;
	    gateway_discovered = true;
	    tradfri.observeDevices();
	    await delay(5000)
	    for (const deviceId in tradfri.devices) {
                const device = tradfri.devices[deviceId];
                var DeviceObj = new Object()
	        DeviceObj.title = device.name
	        DeviceObj.value = deviceId
	        if (typeof(device.plugList) != "undefined") {
		    ikea_devices.push(DeviceObj)
	        }
            }
        }
    } catch (err) {
        console.log("Error in get_ikea_devices after attempts:", err && err.message ? err.message : err);
        gateway_available = false;
        first_run = true;
        // Only set gateway_discovered to false if gateway is not on the network
        if (err.message && err.message.includes("Tradfri gateway not found")) {
            gateway_discovered = false;
        }
        // For other errors (connection issues), leave gateway_discovered as is (it will be set by successful connection)
    } finally {
        gateway_discovering = false;
    }
}

const turn_ikea_device = async (cmd,deviceid) => {
    for(const deviceId in tradfri.devices) {
	if(deviceId === deviceid) {
	    var device = tradfri.devices[deviceId];
	    var accessory = device.plugList[0]
	    accessory.client = tradfri
	    if (cmd == "ON") {
		accessory.turnOn()
	    }
	    if (cmd == "OFF") {
		accessory.turnOff()
	    }
	}
    }
}

function do_not_log() {
    var logger = process.stdout.write
    var dev_null = fs.createWriteStream('/dev/null');
    process.stdout.write = dev_null.write.bind(dev_null);
}
function log() {
    var dev_stdout = fs.createWriteStream('/dev/stdout');
    process.stdout.write = dev_stdout.write.bind(dev_stdout);
}

// Global error handler to prevent crashes
process.on('uncaughtException', (err) => {
    console.log('Uncaught Exception:', err && err.message ? err.message : err);
    // Try to recover by resetting state
    gateway_discovering = false;
    if (tradfri) {
        try { tradfri.destroy(); } catch (e) {}
        tradfri = null;
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.log('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start Roon discovery IMMEDIATELY - don't wait for Tradfri
// This ensures Roon connects as soon as possible, preventing authorization timeouts
init_signal_handlers();
roon.start_discovery();

// Set initial status before gateway discovery starts
update_status();

// Start Tradfri discovery in parallel - it will auto-retry on failure
get_ikea_devices().then(() => {
    update_status();
}).catch(err => {
    console.log('Tradfri discovery failed, will retry:', err && err.message ? err.message : err);
    gateway_available = false;
    if (err.message && err.message.includes("Tradfri gateway not found")) {
        gateway_discovered = false;
    }
    update_status();
});

// Start periodic gateway monitoring
start_gateway_monitor();

function init_signal_handlers() {
    const handle = function(signal) {
        stop_gateway_monitor();
        process.exit(0);
    };

    // Register signal handlers to enable a graceful stop of the container
    process.on('SIGTERM', handle);
    process.on('SIGINT', handle);
}
