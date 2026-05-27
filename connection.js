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

    // Priority 2: If security code provided, use it (regardless of appConfig state)
    // This fixes the issue where stale appConfig credentials prevent authentication
    if (gwcode && gwcode !== "" && gwcode !== undefined) {
      try {
        console.log("Getting identity from security code");
        const { identity, psk } = await tradfri.authenticate(gwcode);

        console.log("Securely connecting to gateway");
        await tradfri.connect(identity, psk);

        // Save to appConfig for Docker compatibility
        conf.set('security', { identity, psk });

        return { tradfri, identity, psk, usedCached: false };
      } catch (authError) {
        console.log("Security code authentication failed:", authError.message);
        // Fall through to try appConfig
      }
    }

    // Priority 3: Try appConfig credentials (for Docker fallback)
    if (conf.has('security.identity') && conf.has('security.psk')) {
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
        // Clear stale credentials
        conf.delete('security');
      }
    }

    // No valid credentials available
    console.log("No valid credentials available - security code required");
    return false;

  } catch (error) {
    console.log(`Failed to connect to Tradfri gateway:`, error.message);
    throw error;
  }
}

export default { getConnection: getConnection };