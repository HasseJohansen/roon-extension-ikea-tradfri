# roon-extension-ikea-tradfri

This is extension for roon to be able to switch Ikea Trådfri power
switches ex. when using an external Power Amplifier or powered
speakers which doesn't have a auto standby feature

A great deal of appreciation goes to:

https://github.com/TheAppgineer (for the extension manager and
plugins) and

https://github.com/AlCalzone (for the node-tradfri-client library)

------------
## Roon Extension Manager
The recommended way to install or update is via the [Roon Extension Manager](https://github.com/TheAppgineer/roon-extension-manager/wiki/Installation).

Install by opening the Settings dialog, select the Roon Tradfri from
the Device Control category and perform the Install action.

If the manager has auto update enabled then changes will be pulled in
the next time the update is performed. It is also possible to update
manually via the Settings dialog, select the Roon Tradfri from the
Device Control category and perform the Update action.

## Manual Installation

1. Install Node.js from https://nodejs.org.

   * On Windows, install from the above link.
   * On Mac OS, you can use [homebrew](http://brew.sh) to install Node.js.
   * On Linux, you can use your distribution's package manager, but make sure it installs a recent Node.js. Otherwise just install from the above link.

   The Roon Tradfri extension has only been tested with node16.x &
   node12.x 

   ```sh
   node -v
   ```

   For example:

   ```sh
   $ node -v
   v12.21.0
   ```

1. Install Git from https://git-scm.com/downloads.
   * Following the instructions for the Operating System you are running.

1. Download the Roon Tradfri extension.

   * Go to the [roon-extension-ikea-tradfri](https://github.com/HasseJohansen/roon-extension-ikea-tradfri/releases) page on [GitHub](https://github.com).
   * Pick the latest release(top one) and pick "Source code (zip)"

1. Extract the zip file in a local folder.

1. Change directory to the extension in the local folder:
    ```
    cd <local_folder>/roon-extension-ikea-tradfri
    ```
    *Replace `<local_folder>` with the local folder path.*

1. Install the dependencies:
    ```bash
    npm install
    ```

1. Run it!
    ```bash
    node .
    ```

    The extension should appear in Roon now. See Settings->Setup->Extensions and you should see it in the list. If you have multiple Roon Cores on the network, all of them should see it.

You can then subscribe to it (basically assigning it to the current
Roon Core)

After that you should go to settings and input the key of your Ikea
Trådfri Gateway(This is on the backside of it). 

The extension won't save this key anywhere, but the underlying
node-tradfri-client library will generate some derived keys from that
key it will use after the first run(and which it will save in it
config location)

After that go to settings again and choose the Ikea Trådfri Plug to
control and the Roon Zone which should control the powerstate

As it is now it will turn the Ikea Trådfri plug on when Roon state is
playing or loading or else it will turn off

I use this with a squeezebox player to control power to a pair of
active speakers in my bedroom (and also in combination with the Alarm
Clock extension). 

The status of the squeezebox is not working properly in Roon and that
is why I use the state playing, loading to turn on and else off. The
correct way would be to use the status field, but that is always
"indeterminate" for squeezeboxes. I think it has to do with a lack of
focus on the squeezebox compatibility

I also have a real Roon endpoint where Roon correctly sets the status
to "standby" when in standby (even though roon says standby_supported:
false on that endpoint - so status/state is really not implemented
well in roon/roon api)

------------
## Troubleshooting

### Gateway Not Found
- **Issue**: The extension reports "IKEA gw not found"
- **Solution**: 
  - Ensure your IKEA Tradfri gateway is powered on and connected to the network
  - Verify the gateway is on the same network as the machine running the extension
  - Check that your network allows multicast/bonjour discovery (required for gateway detection)
  - Restart the gateway by unplugging it for 10 seconds

### Authentication Failed
- **Issue**: "Authentication failed. Please re-enter security code"
- **Solution**:
  - The security code is on the back of your IKEA Tradfri gateway
  - Ensure you're entering the code correctly (it's case-sensitive)
  - If you've previously paired the gateway with another app, you may need to reset it
  - To reset: Press and hold the link button on the gateway for 10+ seconds until the LED blinks amber

### Devices Not Showing Up
- **Issue**: No devices appear in the dropdown after successful authentication
- **Solution**:
  - Ensure your IKEA smart plugs/switches are properly added to the gateway
  - Check that the devices are powered on
  - Wait a few minutes and refresh the extension settings
  - Try restarting the extension

### Connection Drops Frequently
- **Issue**: The extension loses connection to the gateway
- **Solution**:
  - Check your network stability
  - Ensure the gateway and extension host are on the same subnet
  - Try reducing network interference by moving devices closer to the router
  - Check for IP address conflicts on your network

### Extension Not Appearing in Roon
- **Issue**: The extension doesn't show up in Roon's Extensions list
- **Solution**:
  - Ensure Node.js is installed and the extension is running (`node .`)
  - Check that no firewall is blocking the extension's port
  - Verify Roon Core is on the same network
  - Restart Roon and try again
  - Check the console output for errors

### Logs and Debugging
To enable verbose logging for troubleshooting:
```bash
# Set LOG_LEVEL environment variable before starting
LOG_LEVEL=debug node .
```

This will output detailed debug information to the console.

------------
## Docker Deployment

The extension can be run in a Docker container for easier deployment:

### Using Docker Compose

Create a `docker-compose.yml` file:

```yaml
version: '3.8'
services:
  roon-tradfri:
    image: ghcr.io/hassejohansen/roon-extension-ikea-tradfri:latest
    container_name: roon-tradfri
    restart: unless-stopped
    network_mode: host  # Required for Roon discovery and IKEA gateway access
    volumes:
      - ./roon-config:/app/.reg  # Persist Roon pairing state
    environment:
      - LOG_LEVEL=info
```

Run with:
```bash
docker-compose up -d
```

### Using Docker CLI

```bash
docker run -d \
  --name roon-tradfri \
  --restart unless-stopped \
  --network host \
  -v $(pwd)/roon-config:/app/.reg \
  -e LOG_LEVEL=info \
  ghcr.io/hassejohansen/roon-extension-ikea-tradfri:latest
```

**Note**: The `--network host` flag is required for:
- Roon Core discovery (uses multicast)
- IKEA Tradfri gateway discovery (uses bonjour/mDNS)
# PR trigger
