var RoonApi          = require("node-roon-api"),
    RoonApiStatus    = require("node-roon-api-status"),
    RoonApiTransport = require("node-roon-api-transport"),
    RoonApiSettings  = require('node-roon-api-settings'),
    IkeaConnection   = require( './connection' ),
    IkeaDevices      = require( './devices' ),
    Delay            = require( 'delay' );
const fs = require('fs')

var _output_id = "";
var ikea_devices = new Array;
var tradfri
var first_run = false

var roon = new RoonApi({
    extension_id:        'dk.hagenjohansen.roontradfri',
    display_name:        "Roon Tradfri",
    display_version:     "0.0.9",
    publisher:           'Hasse Hagen Johansen',
    email:               'hasse-roon@hagenjohansen.dk',
    website:             'https://github.com/HasseJohansen/roon-extension-ikea-tradfri',

    core_paired: function(core) {
        console.log(core.core_id, core.display_name, core.display_version, "- PAIRED");
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
		    "LOST - attempting to reconnect...");
	
	// Attempt to reconnect by restarting discovery
	// Retry for 5 minutes total (300 seconds): first attempt at 30s, then every 10s
	function attemptReconnect(count, maxAttempts) {
	    // Stop existing discovery
	    if (roon._sood) {
		    roon._sood.stop();
		    delete roon._sood;
	    }
	    
	    // Clear the connection state to allow reconnection
	    delete roon._sood_conns[core.core_id];
	    
	    // Calculate delay: 30s for first attempt, then 10s for subsequent
	    var delay = (count === 0) ? 30000 : 10000;
	    
	    console.log(`Reconnection attempt ${count + 1}/${maxAttempts} in ${delay/1000}s...`);
	    
	    setTimeout(() => {
		    console.log("Restarting Roon discovery...");
		    roon.start_discovery();
		    
		    // Check if we should retry again
		    if (count + 1 < maxAttempts) {
			// Check if we're reconnected by verifying is_paired state
			if (!roon.is_paired) {
			    attemptReconnect(count + 1, maxAttempts);
			} else {
			    console.log("Successfully reconnected to Roon core");
			}
		} else {
		    console.log("Reconnection attempts exhausted after 5 minutes");
		}
	    }, delay);
	}
	
	// Start reconnection attempts: 30s + 27 * 10s = 300s (5 minutes total)
	// We'll do 28 attempts: first at 30s, then 27 more at 10s intervals = 30 + 270 = 300s
	var maxAttempts = 28;
	attemptReconnect(0, maxAttempts);
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
            cb(makelayout(_mysettings));
    },
    save_settings: function(req, isdryrun, settings) {
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

function update_status() {
    if ( (typeof(_mysettings.outputid) != "undefined") && (_mysettings.ikeaplug != null) ) {
        device_name = ikea_devices.filter(device => {
	    return device.value === _mysettings.ikeaplug
        })[0]
        svc_status.set_status(_mysettings.outputid.name + " set to: " + device_name.title, false);
    }
    else {
	svc_status.set_status("First run. Please update settings");
    }
}

const get_ikea_devices = async (gwkey="undefined") => {
    tradfri = await IkeaConnection.getConnection()
    if (typeof(tradfri) != "object" && gwkey != "undefined") {
	tradfri = await IkeaConnection.getConnection(gwkey)
    }
    if (typeof(tradfri) != "object") {
        first_run = true;
    }
    else {
	tradfri = await IkeaConnection.getConnection(gwkey)
	tradfri.observeDevices();
	await Delay(500)
	for (const deviceId in tradfri.devices) {
            const device = tradfri.devices[deviceId];
            DeviceObj = new Object()
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
	    device = tradfri.devices[deviceId];
	    accessory = device.plugList[0]
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
    logger = process.stdout.write
    var dev_null = fs.createWriteStream('/dev/null');
    process.stdout.write = dev_null.write.bind(dev_null);
}
function log() {
    var dev_stdout = fs.createWriteStream('/dev/stdout');
    process.stdout.write = dev_stdout.write.bind(dev_null);
}
init_signal_handlers()
get_ikea_devices().then( () => {
    roon.start_discovery();
    update_status();
})

function init_signal_handlers() {
    const handle = function(signal) {
        process.exit(0);
    };

    // Register signal handlers to enable a graceful stop of the container
    process.on('SIGTERM', handle);
    process.on('SIGINT', handle);
}