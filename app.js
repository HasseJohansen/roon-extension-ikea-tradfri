//"use strict"

var RoonApi          = require("node-roon-api"),
    RoonApiStatus    = require("node-roon-api-status"),
    RoonApiTransport = require("node-roon-api-transport"),
    RoonApiSettings  = require('node-roon-api-settings'),
    IkeaConnection   = require( './connection' ),
    IkeaDevices      = require( './devices' ),
    Delay            = require( 'delay' );

var _output_id = "";
var ikea_devices = new Array;
var tradfri_connection
var first_run

var roon = new RoonApi({
    extension_id:        'dk.hagenjohansen.roontradfri',
    display_name:        "Roon Tradfri",
    display_version:     "0.0.3",
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
    if( first_run ) {
        l.layout.push({
	    type: "string",
	    title: "Ikea gateway secret key(Never stored)",
	    setting: "ikeagwkey",
	})
    }
    else {
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
            if ( (req.body.settings.values) && (!first_run) ) {
                _output_id = req.body.settings.values["outputid"]["output_id"];
            }
        }

        let l = makelayout(settings.values);
        req.send_complete(l.has_error ? "NotValid" : "Success", { settings: l });

        if (!first_run && !l.has_error) {
            _mysettings = l.values;
            svc_settings.update_settings(l);
            roon.save_config("settings", _mysettings);
	    update_status();
        }
	else {
	    IkeaConnection.getConnection(l.values['ikeagwkey'])
	    svc_status.set_status("Not Configured");
	    
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

const get_ikea_devices = async () => {
    const tradfri = await IkeaConnection.getConnection();
    if ( tradfri == false ) {
	first_run = true
    }
    else {
	first_run = false
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
        tradfri_connection = tradfri
    }
}

const turn_ikea_device = async (cmd,deviceid) => {
    for(const deviceId in tradfri_connection.devices) {
	if(deviceId === deviceid) {
	    device = tradfri_connection.devices[deviceId];
	    accessory = device.plugList[0]
	    accessory.client = tradfri_connection
	    if (cmd == "ON") {
		accessory.turnOn()
	    }
	    if (cmd == "OFF") {
		accessory.turnOff()
	    }
	}
    }
}
get_ikea_devices().then( () => {
    roon.start_discovery();
    update_status();
})
