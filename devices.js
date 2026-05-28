import logger from './logger.js';

function printDeviceInfo( device ) {
    switch( device.type ) {
    case 0: // remote
    case 4: // sensor
        logger.info(device.instanceId, device.name, `battery ${device.deviceInfo.battery}%`);
        break;
    case 2: // light
        {
            const lightInfo = device.lightList[0];
            const info = {
                onOff: lightInfo.onOff,
                spectrum: lightInfo.spectrum,
                dimmer: lightInfo.dimmer,
                color: lightInfo.color,
                colorTemperature: lightInfo.colorTemperature
            };
            logger.info(device.instanceId, device.name, lightInfo.onOff ? "On" : "Off", JSON.stringify(info));
        }
        break;
    case 3: // plug
        logger.info(device.instanceId, device.name, device.plugList[0].onOff ? "On" : "Off");
        break;
    default:
        logger.info(device.instanceId, device.name, "unknown type", device.type);
        logger.info(device);
        break;
    }
}

export default printDeviceInfo;
