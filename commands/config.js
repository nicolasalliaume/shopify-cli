const fs = require( 'fs' );
const colors = require( 'colors' );
const path = require( 'path' );

/**
 * Module entry point
 * 
 * @param  {Object} command The parsed command
 */
exports.run = async function( command ) {

	const domain = command.d || command.domain;
	const key = command.k || command.key;
	const password = command.p || command.password;

	if ( !domain || !key || !password ) return printHelp();

	try {
		// remove previous .env if any
		fs.unlinkSync( path.join( '.', '.env' ) );
	}
	catch (e) { /* do nothing, it's safe */ }

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
	fs.writeFileSync( path.join( '.', '.env' ), content );
}

function printHelp() {
	console.log( help() );
}

function help() {
	return `
✅  ${ 'Usage:'.bold } $ shopify-cli config ( --domain | -d ) \
<domain> ( --key | -k ) <api key> ( --password | -p ) <api password>

🙌  ${ 'Example:'.bold } $ shopify-cli config -d sample.myshopify.com \
-k 6570902bf65f43f36263as12asa63093 -p asdasd2345asd2345asd234a5sd234

👉  ${ 'How to get auth information:'.bold.underline }
To get a key and a password, log into your Shopify admin page, go to ${ 'Apps'.italic }, \
scroll down and click on the link that says ${ 'Manage private apps'.underline }. Then, click \
on ${ 'Create a new private app'.bold } and give it a name. Fill in your email too, enable the \
following permissions:

	- Products, variants and collections: ${ 'Read and write'.bold }
	- Theme templates and theme assets: ${ 'Read and write'.bold }
	- Orders, transactions and fulfillments: ${ 'Read and write'.bold }

Save the app and copy the ${ 'API key'.bold } and ${ 'Password'.bold }. Then, here on the \
terminal, run:

	$ shopify-cli config -d <your-store>.myshopify.com -k <paste key here> -p <paste password here>

	Example: $ shopify-cli config -d niceshoes.myshopify.com -k 87123897123897iusd1829798127 \
-p 123898127x389213798j127982sdsda

🌟  This will save your logins ${ 'locally'.bold }, so you don't need to write them every time \
you use the CLI.

Any questions? 📩  nicolas@on-lab.com
	`
}