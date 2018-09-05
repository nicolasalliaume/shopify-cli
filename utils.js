require( 'dotenv' ).config();

const colors = require( 'colors' );
const Shopify = require( 'shopify-api-node' );
const readline = require( 'readline-sync' );
const rimraf = require( 'rimraf' );

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
 * Prompts the user for an input. May provide options
 * as second parameter, and a default option. If no
 * default is provided, first option will be used.
 * 
 * @param  {String} message       
 * @param  {Array}  options       
 * @param  {Array}  defaultOption 
 * @return {String}               
 */
exports.prompt = function( message, options = ['Y/y', 'N/n'], defaultOption = 'y' ) {
	const optionsStr = options && options.length > 0 
		? `(${ options.join( ', ' ) }) [${ defaultOption || options[0] }]` : '';
	return readline.question( `${ message }${ optionsStr }: ` );
}

/**
 * Deletes a dir using `rm -rf`. Returns a promise.
 * 
 * @param  {String} path 
 * @return {Promise}      
 */
exports.rmdir = function( path ) {
	return new Promise( ( resolve, reject ) => {
		rimraf( path, function( error ) { 
			if ( error ) return reject( error );
			resolve();
		} )
	} )
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
