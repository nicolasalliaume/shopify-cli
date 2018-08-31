require( 'dotenv' ).config();

const colors = require( 'colors' );
const Shopify = require( 'shopify-api-node' );

/**
 * Returns auth information indicated in the command, 
 * or pulled from the env.
 * 
 * @param  {String} command The parsed command object.
 * @return {Object}         
 */
exports.getAuth = function( command ) {
	return {
		domain: command.d || command.domain || process.env.DOMAIN,
		apiKey: command.k || command.key || process.env.KEY,
		password: command.p || command.password || process.env.PASSWORD,
	}
}

/**
 * Returns a new instance of the Shopify API object.
 * 
 * @param  {Object} command The parsed command object
 * @return {Object}         
 */
exports.getShopify = function( command ) {
	const { domain, apiKey, password } = exports.getAuth( command );

	if ( !domain || !apiKey || !password ) return instructions();

	const shopName = domain.replace( '.myshopify.com', '' ).replace( 'https://', '' );
	return new Shopify( { shopName, apiKey, password } );
}

/**
 * Fetches a list of themes. Returns a promise that
 * resolves to the array of themes.
 * 
 * @param  {Array} command 
 * @return {Promise}         
 */
exports.getThemes = function( command ) {
	return exports.getShopify( command ).theme.list();
}

/**
 * Throws error with instructions on how to use
 * auth parameters.
 *
 * @throws {Error} 
 */
function instructions() {
	const error = new Error();
	error.statusCode = 999;
	error.message = `
Auth information not provided.
Run the command again using ${ '-d <domain> -k <key> -p <password>'.bold.italic } 

or run ${ '$ shopify-cli config -d <domain> -k <key> -p <password>'.italic.bold } \
to save the authentication information. \
This way you won't have to use the auth params every time.

To get more details on how to get the auth information, run:
	$ shopify-cli config
`
	throw error;
}
