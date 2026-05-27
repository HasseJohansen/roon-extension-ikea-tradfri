import delay from 'delay';
import appConfig from '@anujdatar/appconfig'
import * as  NodeTradfriClient from "node-tradfri-client"
import * as path from 'path' 

const conf = new appConfig({"configDir": "."});
const { discoverGateway, TradfriClient } = NodeTradfriClient;

// Modified to accept cached credentials from Roon config
// Falls back to appConfig if Roon credentials not provided
async function getConnection(gwcode, cachedIdentity, cachedPsk) {
  try {
    console.log(`Looking up IKEA Tradfri gateway on your network`);
    let gateway = await discoverGateway();

    if (gateway == null) {
      console.log("No Tradfri gateway found in local network");
      throw new Error("Tradfri gateway not found");
    }

    console.log("Connecting to", gateway.host);
    const tradfri = new TradfriClient(gateway.addresses[0]);

    // Try Roon config credentials first (passed as parameters)
    if (cachedIdentity && cachedPsk) {
      try {
        console.log("Attempting connection with cached credentials from Roon config");
        await tradfri.connect(cachedIdentity, cachedPsk);
        console.log("Successfully connected with cached credentials");
        return { tradfri, identity: cachedIdentity, psk: cachedPsk, usedCached: true };
      } catch (connectError) {
        console.log("Roon config credentials failed, will try other methods:", connectError.message);
        // Fall through to try appConfig or security code
      }
    }

    // Fall back to appConfig (for Docker or if Roon config not available)
    if (!conf.has('security.identity') || !conf.has('security.psk')) {
      let securityCode = gwcode;
      if (securityCode === "" || securityCode === undefined) {
        console.log("For first time run make sure to set proper gateway security code(bottom of gateway device)");
        return false;
      }

      console.log("Getting identity from security code");
      const { identity, psk } = await tradfri.authenticate(securityCode);

      conf.set('security', { identity, psk });
      // Also try to connect with new credentials
      await tradfri.connect(identity, psk);
      return { tradfri, identity, psk, usedCached: false };
    }

    // Try appConfig credentials
    try {
      console.log("Attempting connection with appConfig credentials");
      await tradfri.connect(conf.get('security.identity'), conf.get('security.psk'));
      return { 
        tradfri, 
        identity: conf.get('security.identity'), 
        psk: conf.get('security.psk'),
        usedCached: true 
      };
    } catch (connectError) {
      console.log("appConfig credentials failed:", connectError.message);
      // Clear stale appConfig credentials
      conf.delete('security');
      return false;
    }

  } catch (error) {
    console.log(`Failed to connect to Tradfri gateway:`, error.message);
    throw error;
  }
}

export default { getConnection: getConnection };