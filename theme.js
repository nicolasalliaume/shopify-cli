const utils = require( './utils' );
const colors = require( 'colors' );

module.exports = function( command ) {

	let action = command[ '__' ][ 1 ];
	if ( action === 'delete' ) action = '_delete'; // delete is a keyword

	if ( command.help ) return printHelp( action );

	if ( [ 'list', 'activate', 'duplicate', 'remove', 'upload', 'rename', 'sync', '_delete' ].includes( action ) ) {
		eval( `${ action }( command )` );
	}
	else return printHelp( action );
}

/**
 * Lists installed themes
 *
 * @param {Object} command The parsed command
 */
async function list( command ) {
	try {
		const themes = await utils.getShopify( command ).theme.list();
		if ( command.json ) return console.log( themes );

		themes.forEach( theme => {
			console.log(`\
🖌  ${ theme.name.bold } ${ theme.role === 'main' ? '(Live theme)'.bgGreen : '' }
    🗓  Created: ${ theme.created_at }
    🗓  Updated: ${ theme.updated_at }
    #️⃣  ID: ${ theme.id }
			`);
		} )
	}
	catch ( e ) {
		showError( e, 'list' );
	}
}

/**
 * Activates one theme
 *
 * @param {Object} command The parsed command
 */
async function activate( command ) {
	const id = command[ 'id' ] || command[ '__' ][ 2 ];
	if ( !id ) return printHelp( 'activate' );

	try {
		const result = await utils.getShopify( command ).theme.update( id, { role: 'main' } );
		if ( command.json ) return console.log( result );

		console.log( `✅  Theme ${ result.name.bold } has been activated.` );
	}
	catch ( e ) { showError( e, 'activate' ) }
}

/**
 * Renames one theme
 *
 * @param {Object} command The parsed command
 */
async function rename( command ) {
	const id = command[ 'id' ] || command[ '__' ][ 2 ];
	let name = command[ 'name' ] || command[ '__' ][ 3 ];
	if ( !id || !name ) return printHelp( 'rename' );

	const shopify = utils.getShopify( command );
	try {
		const theme = await shopify.theme.get( id );

		// replace template variables with actual values
		name = name.replace( /%name%/gi, theme.name ).replace( /%id%/gi, theme.id );

		const result = await shopify.theme.update( id, { name } );
		if ( command.json ) return console.log( result );

		console.log( `✅  Theme ${ theme.name.bold } has been renamed to ${ name.bold.italic }.` );
	}
	catch ( e ) { showError( e, 'rename' ) }
}

/**
 * Removes one or more themes
 *
 * @param {Object} command The parsed command 
 */
async function remove( command ) {
	const ids = command[ 'id' ] ? [ command[ 'id' ] ] : [ ...command[ '__' ] ].splice( 2 );
	if ( ids.length === 0 ) return printHelp( 'remove' );

	try {
		const shopify = utils.getShopify( command );
		const results = await Promise.all( ids.map( id => shopify.theme.delete( id ) ) );
		if ( command.json ) return console.log( results );

		results.forEach( result => console.log( `✅  Theme ${ result.name.bold } has been deleted.` ) );
	}
	catch ( e ) { showError( e, 'remove' ) }
}

/**
 * Alias for remove.
 * 
 * @param  {Object} command The parsed command 
 */
function _delete( command ) { remove( command ) }

/**
 * Duplicates a theme. 
 * 
 * This is not supported out-of-the-box by the API, so what 
 * we do here is create a blank theme and copy all the assets 
 * from the original theme to the new one.
 *
 * @param {Object} command The parsed command
 */
async function duplicate( command ) {
	const id = command[ 'id' ] || command[ '__' ][ 2 ];
	if ( !id ) return printHelp( 'duplicate' );

	try {
		const shopify = utils.getShopify( command );

		// get original theme to have its name
		const originalTheme = await shopify.theme.get( id );
		const name = command.name || command.n || `Copy of ${ originalTheme.name }`;

		// create the new theme
		const newTheme = await shopify.theme.create( { name, role: 'unpublished' } );
		!command.json && console.log( `✅  New theme ${ name.bold } created.` );

		// get list of assets
		const assets = ( await shopify.asset.list( id ) ).map( a => a.key );

		// copy all the assets into the new theme
		await _sync( originalTheme, newTheme, assets, command.json, shopify );

		if ( !command.json ) {
			console.log( `${ assets.length } assets copied.` );
			console.log( `✅  Theme duplicated.` );
		}
		else {
			console.log( newTheme );
		}
	}
	catch ( e ) { 
		showError( e, 'duplicate' );
	}
}

/**
 * Syncs two themes.
 *
 * We do this by copying each asset from the source theme
 * into the dest theme. Is like a duplicate operation, but
 * with a theme that already exists.
 *
 * We may copy only *some* of the assets (if indicated.)
 *
 * @param {Object} command The parsed command
 */
async function sync( command ) {
	const sourceId = command[ '__' ][ 2 ];
	const targetId = command[ '__' ][ 3 ];
	const files = [ ...command[ '__' ] ].splice( 4 );

	if ( !sourceId || !targetId ) return printHelp( 'sync' );

	try {
		const shopify = utils.getShopify( command );

		// get original and target themes to have theirn names
		const sourceTheme = await shopify.theme.get( sourceId );
		const targetTheme = await shopify.theme.get( targetId );

		!command.json && console.log( 
`🔁  Syncing${ files.length > 0 ? ` ${ files.length } ` : '' }asset(s) \
from ${ sourceTheme.name.bold } to ${ targetTheme.name.bold }` );

		// get list of assets
		const assets = ( await shopify.asset.list( sourceId ) ).map( a => a.key );

		if ( files.length > 0 ) {
			// check if the files listed (if any) exist on the source theme.
			// Throw an exception and terminate if one doesn't.
			for ( var i = 0; i < files.length; i++ ) {
				if ( !assets.includes( files[ i ] ) ) {
					throw new Error( `Asset ${ files[ i ] } does not exist in theme ${ sourceTheme.name }` );
				}
			}
		}

		// copy the assets into the new theme
		const keysToCopy = files.length > 0 ? files : assets;
		await _sync( sourceTheme, targetTheme, keysToCopy, command.json, shopify );

		if ( !command.json ) {
			console.log( `${ keysToCopy.length } assets copied.` );
			console.log( `✅  Theme synced.` );
		}
		else {
			console.log( targetTheme );
		}
	}
	catch ( e ) { 
		showError( e, 'duplicate' );
	}
}


async function _sync( sourceTheme, targetTheme, assetKeys, json = false, shopify ) {
	var finished = 0;
	!json && console.log( `⌛️  Copying assets from source theme ${ sourceTheme.name.bold }...` );
	
	// do a nice clock animation to show with the progress
	let currentIconIndex = 0;
	const icons = [ '🕛', '🕒', '🕗', '🕞', '🕧', '🕤' ];

	const progress = () => {
		currentIconIndex = currentIconIndex + 1 === icons.length ? 0 : currentIconIndex + 1;
		process.stdout.write( `  ${ icons[ currentIconIndex ] }  ${ String(finished).bold } of ${ assetKeys.length } copied...\r` );
	}

	const pause = ( ms ) => new Promise( ( resolve, _ ) => {
		setTimeout( () => resolve(), ms );
	} )

	// Fetch every asset and upload to the target theme.
	// This has to be done sequencially, otherwise we get a 
	// 'too many requests' error.
	for ( var i = 0; i < assetKeys.length; i++ ) {
		const key = assetKeys[ i ];
		!json && progress();

		// download full asset (to get the value)
		const { value } = await shopify.asset.get( sourceTheme.id, { asset: { key } } );
		!json && progress();

		// upload asset to target theme
		const r = await shopify.asset.update( targetTheme.id, { key, value } );

		// mark asset is finished and show progress
		finished++; 
		!json && progress();

		// avoid too many requests
		await pause( 500 );
	}

	!json && process.stdout.write( `\n` );
}

/**
 * Uploads a new theme from a zip file or a directory.
 * If it is a directory, zips the directory and sends
 * a zip.
 *
 * The tricky thing here is that the zip must be publicly 
 * accessible via URL, so we need to use something like ngrok
 * or upload the zip somewhere and then use it from Shopify.
 *
 * @investigate @implement @todo
 *
 * @param {Object} command The parsed command
 */
async function upload( command ) {
	console.log( '🤥  Not implemented (yet!)' );
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
		
		case 404: {
			return console.log( 
`❌  Theme not found. Try running ${ '`theme list`'.bold.italic } to see a list of themes available.` 
			);
		}

		case 403: {
			if ( action === 'remove' ) {
				return console.log( 
`❌  Theme cannot be removed. This might be because this theme is active. \
If that's the case, activate another theme and try again.` );
			}
			return console.log( `❌  Operation forbidden.` );
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
		case 'list': return helpList();
		case 'activate': return helpActivate();
		case 'delete': case 'remove': return helpRemove();
		case 'upload': return helpUpload();
		case 'rename': return helpRename();
		case 'duplicate': return helpDuplicate();
		case 'sync': return helpSync();
		default: return helpGeneral();
	}
}

/**
 * Returns a string with the module's help.
 * 
 * @return {String} 
 */
function helpGeneral() {
	return `
✅  ${ 'Usage:'.bold } $ node index.js themes <action> [ params ] [ ( --domain | -d ) <domain> ( --key | -k ) <api key> ( --password | -p ) <api password> ]

🙌  ${ 'Example:'.bold } $ node index.js themes list -d sample.myshopify.com -k 6570902bf65f43f36263as12asa63093 -p asdasd2345asd2345asd234a5sd234
	If you've run the config command before, then there's no need to use -d, -k, ...
   ${ 'Example:'.bold } $ node index.js themes list

👉  ${ 'Available actions:'.bold }

	- list 		Lists all themes
	- activate 		Activates a theme
	- remove 		Removes a theme
	- upload 		Uploads a theme

🤓  ${ '#protip:'.bold.italic } Use --help with an action to get specific help for that action. i.e: $ node index.js themes list --help
	`
}

/**
 * Returns a string with help for the `list` action of this
 * module.
 * 
 * @return {String} 
 */
function helpList() {
	return `
✅  ${ 'Usage:'.bold } $ node index.js themes list [ ( --domain | -d ) <domain> ( --key | -k ) <api key> ( --password | -p ) <api password> ]

🙌  ${ 'Example:'.bold } $ node index.js themes list -d sample.myshopify.com -k 6570902bf65f43f36263as12asa63093 -p asdasd2345asd2345asd234a5sd234
	If you've run the config command before, then there's no need to use -d, -k, ...
   ${ 'Example:'.bold } $ node index.js themes list

🤓  ${ '#protip:'.bold.italic } Use --json to get a JSON output instead of the pretty one.
	`
}

/**
 * Returns a string with help for the `activate` action of this
 * module.
 * 
 * @return {String} 
 */
function helpActivate() {
	return `
✅  ${ 'Usage:'.bold } $ node index.js themes activate <id> [ ( --domain | -d ) <domain> ( --key | -k ) <api key> ( --password | -p ) <api password> ]

🙌  ${ 'Example:'.bold } $ node index.js themes activate 129823982 -d sample.myshopify.com -k 6570902bf65f43f36263as12asa63093 -p asdasd2345asd2345asd234a5sd234
	If you've run the config command before, then there's no need to use -d, -k, ...
   ${ 'Example:'.bold } $ node index.js themes activate 129823982
	`
}

/**
 * Returns a string with help for the `remove` action of this
 * module.
 * 
 * @return {String} 
 */
function helpRemove() {
	return `
✅  ${ 'Usage:'.bold } $ node index.js themes remove <id> [ ( --domain | -d ) <domain> ( --key | -k ) <api key> ( --password | -p ) <api password> ]

🙌  ${ 'Example:'.bold } $ node index.js themes remove 123871292 -d sample.myshopify.com -k 6570902bf65f43f36263as12asa63093 -p asdasd2345asd2345asd234a5sd234
	If you've run the config command before, then there's no need to use -d, -k, ...
   ${ 'Example:'.bold } $ node index.js themes remove 123871292
	`
}

/**
 * Returns a string with help for the `duplicate` action of this
 * module.
 * 
 * @return {String} 
 */
function helpDuplicate() {
	return `
✅  ${ 'Usage:'.bold } $ node index.js themes duplicate <id> [ --name <name> ( --domain | -d ) <domain> ( --key | -k ) <api key> ( --password | -p ) <api password> ]

👉  Available options:

	--name 		Name to use for the new Theme (optional)

🙌  ${ 'Example:'.bold } $ node index.js themes duplicate 123871292 --name "Duplicated theme" -d sample.myshopify.com -k 6570902bf65f43f36263as12asa63093 -p asdasd2345asd2345asd234a5sd234
	If you've run the config command before, then there's no need to use -d, -k, ...
   ${ 'Example:'.bold } $ node index.js themes duplicate 123871292 --name "Duplicated theme"

	If no name is provided, "Copy of " will be used, like Shopify does.
	`
}

/**
 * Returns a string with help for the `rename` action of this
 * module.
 * 
 * @return {String} 
 */
function helpRename() {
	return `
✅  ${ 'Usage:'.bold } $ node index.js themes rename <id> <name> [ ( --domain | -d ) <domain> ( --key | -k ) <api key> ( --password | -p ) <api password> ]

🙌  ${ 'Example:'.bold } $ node index.js themes rename 123871292 "New name" -d sample.myshopify.com -k 6570902bf65f43f36263as12asa63093 -p asdasd2345asd2345asd234a5sd234
	If you've run the config command before, then there's no need to use -d, -k, ...
   ${ 'Example:'.bold } $ node index.js themes rename 123871292 "New name"

🤓  ${ '#protip:'.bold.italic } --name can be used with this command to set the new name.
🤓  ${ '#superprotip:'.bold.italic } Use %name% and %id% as a template variables. They will be replaced with the value from the ${ 'old'.bold } theme.
	`
}

/**
 * Returns a string with help for the `sync` action of this
 * module.
 * 
 * @return {String} 
 */
function helpSync() {
	return `
✅  ${ 'Usage:'.bold } $ node index.js themes sync <id source> <id target> [ files ] [ ( --domain | -d ) <domain> ( --key | -k ) <api key> ( --password | -p ) <api password> ]

🙌  ${ 'Example:'.bold } $ node index.js themes sync 123871292 888279221 -d sample.myshopify.com -k 6570902bf65f43f36263as12asa63093 -p asdasd2345asd2345asd234a5sd234
	If you've run the config command before, then there's no need to use -d, -k, ...
   ${ 'Example:'.bold } $ node index.js themes sync 123871292 888279221

   You can also indicate which files you want to sync, like this:
   ${ 'Example:'.bold } $ node index.js themes sync 123871292 888279221 assets/main.js layouts/theme.liquid ...
	`
}

/**
 * Returns a string with help for the `upload` action of this
 * module.
 * 
 * @return {String} 
 */
function helpUpload() {
	return `
✅  ${ 'Usage:'.bold } $ node index.js themes upload <id> [ ( --domain | -d ) <domain> ( --key | -k ) <api key> ( --password | -p ) <api password> ]

🙌  ${ 'Example:'.bold } $ node index.js themes upload 288929917 -d sample.myshopify.com -k 6570902bf65f43f36263as12asa63093 -p asdasd2345asd2345asd234a5sd234
	If you've run the config command before, then there's no need to use -d, -k, ...
   ${ 'Example:'.bold } $ node index.js themes upload 288929917
	`
}