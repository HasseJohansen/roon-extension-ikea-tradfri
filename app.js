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
var gateway_check_timer = null
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
    var l = {
             values:    settings,
             layout:    [],
             has_error: false
    };
    if( first_run == true ) {
	do_not_log()
        l.layout.push({
	    type: "string",
	    title: "Ikea gateway secret key",
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
        l.layout.push({
        type:    "dropdown",
        title:   "IkeaPlug",
        values:  ikea_devices,
        setting: "ikeaplug",
        });
    }
    return l;
}

var svc_settings = new RoonApiSettings(roon, {
        get_settings: function(cb) {
            if (!gateway_available) {
                cb({
                    values: _mysettings,
                    layout: [{
                        type: "string",
                        title: "IKEA gateway not available - please check your connection",
                        setting: "gateway_status",
                        readonly: true
                    }],
                    has_error: false
                });
                return;
            }
            cb(makelayout(_mysettings));
    },
    save_settings: function(req, isdryrun, settings) {
        if (!gateway_available) {
            req.send_complete("NotValid", { settings: {
                values: _mysettings,
                layout: [{
                    type: "string",
                    title: "IKEA gateway not available - please check your connection",
                    setting: "gateway_status",
                    readonly: true
                }],
                has_error: true
            } });
            return;
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
		svc_status.set_status("Not Configured");
	    })
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
    if (!gateway_available) {
        svc_status.set_status("IKEA gateway not available");
    }
    else if ( (typeof(_mysettings.outputid) != "undefined") && (_mysettings.ikeaplug != null) ) {
        var device_name = ikea_devices.filter(device => {
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
}

const check_gateway = async () => {
    try {
        // Try to get connection without retrying (fast check)
        const test_conn = await IkeaConnection.getConnection();
        const is_available = typeof test_conn === "object";
        
        if (is_available && !gateway_available) {
            console.log("IKEA gateway became available, reconnecting...");
            // Clear old devices and reconnect
            ikea_devices = new Array();
            await get_ikea_devices();
            gateway_available = true;
            update_status();
        } else if (!is_available && gateway_available) {
            console.log("IKEA gateway became unavailable");
            gateway_available = false;
            tradfri = null;
            update_status();
        }
    } catch (err) {
        if (gateway_available) {
            console.log("IKEA gateway check failed:", err && err.message ? err.message : err);
            gateway_available = false;
            tradfri = null;
            update_status();
        }
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

const get_ikea_devices = async (gwkey="undefined") => {
    tradfri = await IkeaConnection.getConnection()
    if (typeof(tradfri) != "object" && gwkey != "undefined") {
	tradfri = await IkeaConnection.getConnection(gwkey)
    }
    if (typeof(tradfri) != "object") {
        first_run = true;
        gateway_available = false;
    }
    else {
	tradfri = await IkeaConnection.getConnection(gwkey)
	tradfri.observeDevices();
	await delay(5000)
	gateway_available = true;
	for (const deviceId in tradfri.devices) {
            const device = tradfri.devices[deviceId];
            var DeviceObj = new Object()
	    DeviceObj.title = device.name
	    DeviceObj.value = deviceId
	    if (typeof(device.plugList) != "undefined") {
		ikea_devices.push(DeviceObj)
	    }
        }
	tradfri = tradfri;
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

// Start Roon discovery IMMEDIATELY - don't wait for Tradfri
// This ensures Roon connects as soon as possible, preventing authorization timeouts
init_signal_handlers();
roon.start_discovery();

// Start Tradfri discovery in parallel - it will auto-retry on failure
get_ikea_devices().then(() => {
    update_status();
}).catch(err => {
    console.log('Tradfri discovery failed, will retry:', err && err.message ? err.message : err);
    gateway_available = false;
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
