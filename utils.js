require( 'dotenv' ).config();

const colors = require( 'colors' );
const Shopify = require( 'shopify-api-node' );

exports.getShopify = function( command ) {
	const domain = command.d || command.domain || process.env.DOMAIN;
	const apiKey = command.k || command.key || process.env.KEY;
	const password = command.p || command.password || process.env.PASSWORD;

	if ( !domain || !apiKey || !password ) return instructions();

	const shopName = domain.replace( '.myshopify.com', '' ).replace( 'https://', '' );
	return new Shopify( { shopName, apiKey, password } );
}

function instructions() {
	const error = new Error();
	error.statusCode = 999;
	error.message = `
Auth information not provided.
Run the command again using ${ '-d <domain> -k <key> -p <password>'.bold.italic } 

or run ${ '$ shopify-cli config -d <domain> -k <key> -p <password>'.italic.bold } to save the authentication information. \
This way you won't have to use the auth params every time.

To get more details on how to get the auth information, run:
	$ shopify-cli config
`
	throw error;
}