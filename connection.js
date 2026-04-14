import delay from 'delay';
import appConfig from '@anujdatar/appconfig'
import * as  NodeTradfriClient from "node-tradfri-client"
import * as path from 'path' 

const conf = new appConfig({"configDir": "."});
const { discoverGateway, TradfriClient } = NodeTradfriClient;

// Maximum number of retries for gateway connection
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000; // 5 seconds between retries

async function getConnection(gwcode, retryCount = 0) {
  try {
    console.log(`Looking up IKEA Tradfri gateway on your network${retryCount > 0 ? ` (attempt ${retryCount + 1})` : ''}`);
    let gateway = await discoverGateway();

    if (gateway == null) {
      if (retryCount >= MAX_RETRIES) {
        console.log("No Tradfri gateway found in local network after multiple attempts");
        throw new Error("Tradfri gateway not found");
      }
      console.log("Tradfri gateway not found, retrying...");
      await delay(RETRY_DELAY_MS);
      return getConnection(gwcode, retryCount + 1);
    }

    console.log("Connecting to", gateway.host);
    const tradfri = new TradfriClient(gateway.addresses[0]);

    if (!conf.has('security.identity') || !conf.has('security.psk')) {
      let securityCode = gwcode;
      if (securityCode === "" || securityCode === undefined) {
        console.log("For first time run make sure to set proper gateway security code(bottom of gateway device)");
        return false;
      }

      console.log("Getting identity from security code");
      const { identity, psk } = await tradfri.authenticate(securityCode);

      conf.set('security', { identity, psk });
    }

    console.log("Securely connecting to gateway");

    await tradfri.connect(conf.get('security.identity'), conf.get('security.psk'));

    return tradfri;
  } catch (error) {
    if (retryCount >= MAX_RETRIES) {
      console.log(`Failed to connect to Tradfri gateway after ${MAX_RETRIES} attempts:`, error.message);
      throw error; // Re-throw to let caller handle
    }
    console.log(`Tradfri connection failed (attempt ${retryCount + 1}): ${error.message}. Retrying in ${RETRY_DELAY_MS / 1000} seconds...`);
    await delay(RETRY_DELAY_MS);
    return getConnection(gwcode, retryCount + 1);
  }
}

export default { getConnection: getConnection };
