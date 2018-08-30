const fs = require( 'fs' );

module.exports = async function( command ) {

	const domain = command.d || command.domain;
	const key = command.k || command.key;
	const password = command.p || command.password;

	if ( !domain || !key || !password ) return printHelp();

	try {
		// remove previous .env if any
		fs.unlinkSync( '.env' );
	}
	catch (e) { /* do nothing */ }
	// write new .env with config params
	writeConfigFile( domain, key, password );

	console.log( `
Configured site:
🌎  ${domain}
🔑  ${key}
🔑  ${password}
` );
}

function indexOf( e, arr ) {
	const idx = arr.indexOf( e );
	if ( idx >= 0 ) return idx;
	return null;
}

function writeConfigFile( domain, key, password ) {
	const content = `DOMAIN=${domain}\nKEY=${key}\nPASSWORD=${password}`;
	fs.writeFileSync( '.env', content );
}

function printHelp() {
	console.log( help() );
}

function help() {
	return `
✅  Usage: $ node index.js config ( --domain | -d ) <domain> ( --key | -k ) <api key> ( --password | -p ) <api password>

🙌  Example: $ node index.js config -d sample.myshopify.com -k 6570902bf65f43f36263as12asa63093 -p asdasd2345asd2345asd234a5sd234
	`
}