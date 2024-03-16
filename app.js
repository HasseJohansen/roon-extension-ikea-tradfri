import delay from 'delay';
import RoonApi from "node-roon-api"
import RoonApiStatus from "node-roon-api-status"
import RoonApiTransport from "node-roon-api-transport"
import RoonApiSettings from 'node-roon-api-settings'
import IkeaConnection from './connection.js' 
import IkeaDevices from './devices.js' 
import fs from 'fs'

var _output_id = "";
var ikea_devices = new Array;
var tradfri
var first_run = false

var roon = new RoonApi({
    extension_id:        'dk.hagenjohansen.roontradfri',
    display_name:        "Roon Tradfri",
    display_version:     "0.0.14",
    publisher:           'Hasse Hagen Johansen',
    email:               'hasse-roon@hagenjohansen.dk',
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
        var device_name = ikea_devices.filter(device => {
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
	await delay(500)
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
