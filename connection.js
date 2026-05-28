import * as NodeTradfriClient from "node-tradfri-client";

const { discoverGateway, TradfriClient } = NodeTradfriClient;

// Modified to accept cached credentials from Roon config only
// Removed appConfig dependency to avoid writing credentials to arbitrary directories
async function getConnection(gwcode, cachedIdentity, cachedPsk) {
    try {
        console.log(`Looking up IKEA Tradfri gateway on your network`);
        const gateway = await discoverGateway();

        if (gateway === null) {
            console.log("No Tradfri gateway found in local network");
            throw new Error("Tradfri gateway not found");
        }

        console.log("Connecting to", gateway.host);
        const tradfri = new TradfriClient(gateway.addresses[0]);

        // Priority 1: Try Roon config credentials first (passed as parameters)
        if (cachedIdentity && cachedPsk) {
            try {
                console.log("Attempting connection with cached credentials from Roon config");
                await tradfri.connect(cachedIdentity, cachedPsk);
                console.log("Successfully connected with cached credentials");
                return { tradfri, identity: cachedIdentity, psk: cachedPsk, usedCached: true };
            } catch (connectError) {
                console.log("Roon config credentials failed:", connectError.message);
                // Fall through to try security code
            }
        }

        // Priority 2: If security code provided, use it
        if (gwcode && gwcode !== "" && gwcode !== undefined) {
            try {
                console.log("Getting identity from security code");
                const { identity, psk } = await tradfri.authenticate(gwcode);

                console.log("Securely connecting to gateway");
                await tradfri.connect(identity, psk);

                return { tradfri, identity, psk, usedCached: false };
            } catch (authError) {
                console.log("Security code authentication failed:", authError.message);
                throw authError; // Re-throw to allow caller to handle
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
