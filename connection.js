const appConfig = require('@anujdatar/appconfig')
const delay             = import('delay');
const NodeTradfriClient = require("node-tradfri-client");
const path              = require( 'path' );

const conf = new appConfig({"configDir": "."});
const { discoverGateway, TradfriClient } = NodeTradfriClient;

async function getConnection(gwcode) {
  console.log( "Looking up IKEA Tradfri gateway on your network" )
  let gateway = await discoverGateway()

  if( gateway == null ) {
    console.log( "No Tradfri gateway found in local network" );
    process.exit(1);
  }

  console.log( "Connecting to", gateway.host)
  const tradfri = new TradfriClient(gateway.addresses[0])

  if( !conf.has( 'security.identity' ) || !conf.has('security.psk' ) ) {
    let securityCode = gwcode
    if( securityCode === "" || securityCode === undefined ) {
      console.log( "For first time run make sure to set proper gateway security code(bottom of gateway device)")
      return false
    }

    console.log( "Getting identity from security code" )
    const {identity, psk} = await tradfri.authenticate(securityCode);

    conf.set( 'security', {identity,psk} )
  }

  console.log( "Securely connecting to gateway" )

  await tradfri.connect(conf.get( 'security.identity' ), conf.get( 'security.psk' ))

  return tradfri;
}

module.exports = {getConnection: getConnection};

// Only run this method if invoked with "node connection.js"
if( __filename === process.argv[1] ) {
  (async () => {
    const tradfri = await getConnection();
    console.log( "Connection complete" )

    console.log( "Waiting 1 second")
    await delay( 1000 )

    console.log( "Closing connection")
    tradfri.destroy()
    process.exit(0);
  })()
}
