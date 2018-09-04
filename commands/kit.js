const colors = require( 'colors' );
const path = require( 'path' );
const utils = require( '../utils' );
const fs = require( 'fs' );
const cmd = require( 'node-cmd' );

/**
 * Module entry point
 * 
 * @param  {Object} command The parsed command
 */
exports.run = function( command ) {

	let action = command[ '__' ][ 1 ];

	if ( command.help ) return printHelp( action );

	switch ( action ) {

		case 'install': return install( command );

		case 'config': return config( command );

		default: return printHelp( action );
	}
}

async function install( ) {
	const command = 'curl -s https://raw.githubusercontent.com/Shopify/themekit/master/scripts/install | sudo python';
	return new Promise( ( resolve, reject ) => {
		cmd.get( command , function( err, data, stderr ) {
			if ( err ) {
				showError( err );
				return reject( err );
			}
			console.log( data );
			return resolve();
		} );
	} );
}

/**
 * Creates a config file for Theme Kit.
 *
 * Optionally, the command may specify:
 *  - Output directory for the file
 *  - Name for the file
 *  - Include all themes, just one, or many
 * 
 * @param  {Object} command The parsed command.
 */
async function config( command ) {
	const includeAll = command.all || command.a;
	const output = command.out || command.o || '.';
	const filename = command.name || command.n || 'config.yml';
	const includeThemes = ( command.t || command.theme || '' ).split( ',' ).filter( t => !!t );

	try {
		let themes = await utils.getThemes( command );
		// filter themes to include if specified
		if ( includeThemes.length > 0 ) {
			themes = themes.filter( ({ id }) => includeThemes.includes( String( id ) ) );
		}

		// check if we have at least one theme
		if ( themes.length === 0 ) {
			throw Error( `No themes available. Either your store has no themes, \
or the following themes do not exist: 
${ includeThemes.join(', ') }` );
		}

		// auth information.
		// use specified in the command (if any), or pull from the env
		const { domain, apiKey, password } = utils.getAuth( command );

		// create file with theme configs
		exports.writeConfig( themes, domain, password, output, filename );

		if ( command.json ) return console.log({ ok: 1 });

		const namesForLog = themes.map( ({ name }) => exports.sanitizeThemeName( name ).bold );
		console.log( 
`✅  File ${ path.join( output, filename ) } created.

👉  The following theme configs have been created: \n\t${ namesForLog.join( '\n\t' ) }` );

	}
	catch ( e ) { showError( e, 'create' ) }
}

/**
 * Writes a config file that contains each of the given
 * themes as an environment to use with theme kit.
 * 
 * @param  {Array} themes   Array of theme objects
 * @param  {String} domain   
 * @param  {String} password 
 * @param  {String} output   
 * @param  {String} filename    
 */
exports.writeConfig = function( themes, domain, password, output = '.', filename = 'config.yml' ) {
	const outPath = path.join( output, filename );

	const template = `{ name }:\n  password: { password }\n  theme_id: { id }\n  store: { domain }`;
	const applyTemplate = ({ id, name }) => (
		template
			.replace( '{ name }', exports.sanitizeThemeName( name ) )
			.replace( '{ id }', id )
			.replace( '{ password }', password)
			.replace( '{ domain }', domain ) );
	
	const content = themes.map( applyTemplate ).join('\n\n');

	// write file on the indicated output dir, or 
	// on the local dir if not specified
	fs.writeFileSync( outPath, content, 'utf8' );
}

/**
 * Returns a sanitized version of a theme name to use
 * in the config 
 * 
 * @param  {String} name 
 * @return {String}      
 */
exports.sanitizeThemeName = function( name ) {
	return name.replace( /\s/g, '-' ).replace( /[^\w-_]/gi, '' ).toLowerCase();
}

/**
 * Shows an error message.
 * The message might be tailored depending on the action
 * being performed.
 * 
 * @param  {Error} e      
 * @param  {String} action 
 */
function showError( e, action ) {
	switch ( e.statusCode ) {

		case 999: { // our own Auth error
			return console.log( e.message );
		}

		default: {
			console.log( `❌  An error ocurred.` );
			console.error( e );
		}
	}
}

/**
 * Prints help message for the given action
 * 
 * @param  {String} action 
 */
function printHelp( action ) {
	console.log( help( action ) );
}

/**
 * Returns the appropiate help string for the given action
 * 
 * @param  {String} action 
 * @return {String}        
 */
function help( action ) {
	switch ( action ) {
		case 'install': return helpInstall();
		case 'config': return helpConfig();
		default: return helpGeneral();
	}
}

/**
 * Returns a string with the config command's help.
 * 
 * @return {String} 
 */
function helpConfig() {
	return `
✅  ${ 'Usage:'.bold } $ shopify-cli kit config [ -t <theme id>,<theme id>,... ] \
[ ( --domain | -d ) <domain> ( --key | -k ) <api key> ( --password | -p ) <api password> ]

🙌  ${ 'Example:'.bold } $ shopify-cli kit config -d sample.myshopify.com \
-k 6570902bf65f43f36263as12asa63093 -p asdasd2345asd2345asd234a5sd234
	If you've run the config command before, then there's no need to use -d, -k, ...
   ${ 'Example:'.bold } $ shopify-cli kit config

   All themes will be inclided, unless you indicate which ones you wish to include (using \`-t\`)
   ${ 'Example:'.bold } $ shopify-cli kit config -t 123871292,888279221
	`
}

/**
 * Returns a string with the install command's help.
 * 
 * @return {String} 
 */
function helpInstall() {
	return `🤥  Not implemented (yet!)`;
}

/**
 * Returns a string with the module's help.
 * 
 * @return {String} 
 */
function helpGeneral() {
	return `
This module provides integrations with Shopify Theme Kit. To learn more about Theme Kit, \
visit ${ 'https://shopify.github.io/themekit/'.underline }.

✅  ${ 'Usage:'.bold } $ shopify-cli kit <action> [ params ] [ ( --domain | -d ) <domain> ( --key | -k ) \
<api key> ( --password | -p ) <api password> ]

🙌  ${ 'Example:'.bold } $ shopify-cli kit config -o /Users/some/path/to/dir -d sample.myshopify.com \
-k 6570902bf65f43f36263as12asa63093 -p asdasd2345asd2345asd234a5sd234
	If you've run the config command before, then there's no need to use -d, -k, ...
   ${ 'Example:'.bold } $ shopify-cli kit config -o /Users/some/path/to/dir 

👉  ${ 'Available actions:'.bold }

	- install 		Installes Theme Kit (Python needed)
	- config 		Creates a config file for Theme Kit

🤓  ${ '#protip:'.bold.italic } Use --help with an action to get specific help for that action. \
i.e: $ shopify-cli kit config --help
	`
}