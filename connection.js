import delay from 'delay';
import * as NodeTradfriClient from "node-tradfri-client"

const { discoverGateway, TradfriClient } = NodeTradfriClient;

// Modified to use Roon's config system instead of appConfig filesystem storage
// This works with Kubernetes ConfigMaps which are read-only
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

    // Try cached credentials first (from Roon config)
    if (cachedIdentity && cachedPsk) {
      try {
        console.log("Attempting connection with cached credentials");
        await tradfri.connect(cachedIdentity, cachedPsk);
        console.log("Successfully connected with cached credentials");
        // Return tradfri client and indicate we used cached credentials
        return { tradfri, identity: cachedIdentity, psk: cachedPsk, usedCached: true };
      } catch (connectError) {
        console.log("Cached credentials failed, will try to re-authenticate:", connectError.message);
        // Fall through to try authentication with security code
      }
    }

    // Need security code to authenticate
    let securityCode = gwcode;
    if (securityCode === "" || securityCode === undefined) {
      console.log("For first time run make sure to set proper gateway security code(bottom of gateway device)");
      return false;
    }

    console.log("Getting identity from security code");
    const { identity, psk } = await tradfri.authenticate(securityCode);

    console.log("Securely connecting to gateway");
    await tradfri.connect(identity, psk);

    // Return tradfri client with new credentials
    return { tradfri, identity, psk, usedCached: false };

  } catch (error) {
    console.log(`Failed to connect to Tradfri gateway:`, error.message);
    throw error;
  }
}

export default { getConnection: getConnection };