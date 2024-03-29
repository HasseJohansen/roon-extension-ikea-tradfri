import delay from 'delay';
import * as connection from './connection.js'

function printDeviceInfo( device ) {
  switch( device.type ) {
    case 0: // remote
    case 4: // sensor
      console.log( device.instanceId, device.name, `battery ${device.deviceInfo.battery}%` )
      break;
    case 2: // light
      let lightInfo = device.lightList[0]
      let info = {
        onOff: lightInfo.onOff,
        spectrum: lightInfo.spectrum,
        dimmer: lightInfo.dimmer,
        color: lightInfo.color,
        colorTemperature: lightInfo.colorTemperature
      }
      console.log( device.instanceId, device.name, lightInfo.onOff ? "On" : "Off", JSON.stringify( info) )
      break;
    case 3: // plug
      console.log( device.instanceId, device.name, device.plugList[0].onOff ? "On" : "Off" )
      break;
    default:
      console.log( device.instanceId, device.name, "unknown type", device.type)
      console.log( device )
  }
}

function findDevice( tradfri, deviceNameOrId ) {
  let lowerName = deviceNameOrId.toLowerCase();

  for( const deviceId in tradfri.devices ) {
    if( deviceId === deviceNameOrId ) {
      return tradfri.devices[deviceId];
    }

    if( tradfri.devices[deviceId].name.toLowerCase() === lowerName ) {
      return tradfri.devices[deviceId];
    }
  }

  return;
}

export default {printDeviceInfo, findDevice};
