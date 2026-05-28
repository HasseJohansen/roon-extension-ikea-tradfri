import * as NodeTradfriClient from "node-tradfri-client";
import logger from './logger.js';

const { discoverGateway, TradfriClient } = NodeTradfriClient;

// Modified to accept cached credentials from Roon config only
// Removed appConfig dependency to avoid writing credentials to arbitrary directories
async function getConnection(gwcode, cachedIdentity, cachedPsk) {
    try {
        logger.info(`Looking up IKEA Tradfri gateway on your network`);
        const gateway = await discoverGateway();

        if (gateway === null) {
            logger.info("No Tradfri gateway found in local network");
            throw new Error("Tradfri gateway not found");
        }

        logger.info("Connecting to", gateway.host);
        const tradfri = new TradfriClient(gateway.addresses[0]);

        // Priority 1: Try Roon config credentials first (passed as parameters)
        if (cachedIdentity && cachedPsk) {
            try {
                logger.info("Attempting connection with cached credentials from Roon config");
                await tradfri.connect(cachedIdentity, cachedPsk);
                logger.info("Successfully connected with cached credentials");
                return { tradfri, identity: cachedIdentity, psk: cachedPsk, usedCached: true };
            } catch (connectError) {
                logger.error("Roon config credentials failed:", connectError.message);
                // Fall through to try security code
            }
        }

        // Priority 2: If security code provided, use it
        if (gwcode && gwcode !== "" && gwcode !== undefined) {
            try {
                logger.info("Getting identity from security code");
                const { identity, psk } = await tradfri.authenticate(gwcode);

                logger.info("Securely connecting to gateway");
                await tradfri.connect(identity, psk);

                return { tradfri, identity, psk, usedCached: false };
            } catch (authError) {
                logger.error("Security code authentication failed:", authError.message);
                throw authError; // Re-throw to allow caller to handle
            }
        }

        // No valid credentials available
        logger.info("No valid credentials available - security code required");
        return false;

    } catch (error) {
        logger.error(`Failed to connect to Tradfri gateway:`, error.message);
        throw error;
    }
}

export default { getConnection: getConnection };
