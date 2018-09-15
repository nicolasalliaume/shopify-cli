const utils = require( '../utils' );
const colors = require( 'colors' );
const themeKit = require('@shopify/themekit');
const fs = require( 'fs' );
const kit = require( './kit' );

/**
 * Actions supported by this module
 */
const SUPPORTS = [ 'list', 'activate', 'duplicate', 'remove', 'upload', 'rename', 'sync', '_delete', 'bootstrap', 'install' ];
const THEMES = [ 'brooklyn', 'boundless', 'debut', 'jumpstart','minimal', 'narrative', 'pop', 'simple', 'supply', 'venture' ];

/**
 * Exports to the outside world, so they can be
 * used by outside scripts.
 */
exports.activate = activate;
exports.rename = rename;
exports.remove = remove;
exports.bootstrap = bootstrap;
exports.installTheme = installTheme;
exports.duplicate = duplicate;
exports.sync = sync;
exports._sync = _sync;
exports.upload = upload;

/**
 * Module entry point
 * 
 * @param  {Object} command The parsed command
 */
exports.run = function( command ) {

	let action = command[ '__' ][ 1 ];
	if ( action === 'delete' ) action = '_delete'; // delete is a keyword

	if ( command.help ) return printHelp( action );

	if ( SUPPORTS.includes( action ) ) {
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
		const themes = await utils.getThemes( command );
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
	let ids = command[ 'id' ] ? [ command[ 'id' ] ] : [ ...command[ '__' ] ].splice( 2 );
	const all = command.all;

	if ( !all && ids.length === 0 ) return printHelp( 'remove' );

	// ask for user confirmation if we're deleting all themes
	// and no -y or --yes flag present.
	if ( all && !command.y || command.yes ) {
		if ( !promptDeleteAllThemes() ) return;
	}

	try {
		const shopify = utils.getShopify( command );

		if ( all ) {
			// fetch all non-active theme ids
			const themes = await utils.getThemes( command );
			ids = themes.filter( t => t.role !== 'main' ).map( t => t.id );

			// check if there're themes to delete
			if ( ids.length === 0 ) {
				return console.log( '👎  No themes that can be deleted are available.' );
			}
		}

		const results = await Promise.all( ids.map( id => shopify.theme.delete( id ) ) );
		if ( command.json ) return console.log( results );

		results.forEach( result => console.log( `✅  Theme ${ result.name.bold } has been deleted.` ) );
	}
	catch ( e ) { showError( e, 'remove' ) }
}

/**
 * Promps the user to confirm if they want to delete
 * all non-active themes.
 * 
 * @return {Boolean}
 */
function promptDeleteAllThemes() {
	return [ 'y' ].includes( utils.prompt( 
`Do you really want to delete ${ 'all'.black } non-active themes from this shop? `, undefined, 'n' ).toLowerCase() );
}

/**
 * Alias for remove.
 * 
 * @param  {Object} command The parsed command 
 */
function _delete( command ) { remove( command ) }

/**
 * Alias for bootstrap
 */
function install( command ) { bootstrap( command ) }

/**
 * Installs one or more of the free shopify templates that 
 * are available.
 * 
 * The themes are stored as zip files in an S3 bucket with 
 * public read access. This is a workaround, since Shopify
 * doesn't provide a way to install those themes using an API
 * endpoint.
 * 
 * @param  {Object} command The parsed command
 */
async function bootstrap( command ) {
	let names = command[ 'name' ] || command[ 'n' ] || [ ...command[ '__' ] ].splice( 2 );
	const all = command.all;

	if ( names.length === 0 && !all ) return printHelp( 'bootstrap' );

	if ( all ) names = THEMES;
	
	// install all themes sequencially
	try {
		for (var i = 0; i < names.length; i++) {
			await installTheme( names[i], command );
		}
	}
	catch( e ) {
		showError( e, 'bootstrap' );
	}
}

/**
 * Installs a shopify theme.
 * 
 * The themes are stored as zip files in an S3 bucket with 
 * public read access named with the following pattern: <name>.zip
 *
 * @param  {Stirng} _name Name of the theme to install
 * @param  {Object} command The parsed command
 */
async function installTheme( _name, command ) {
	const name = _name.toLowerCase();

	// verify if the theme exists
	if ( !THEMES.includes( name ) ) return printHelp( 'bootstrap' );

	const url = `https://s3.amazonaws.com/shopify-cli-store/${ name }.zip`;
	const capitalizedName = name.charAt( 0 ).toUpperCase() + name.slice( 1 );

	const shopify = utils.getShopify( command );
	const theme = {
		name: capitalizedName,
		src: url,
		role: 'unpublished',
	}

	// install theme
	const response = await shopify.theme.create( theme );
	if ( command.json ) return console.log( response );

	console.log( `✅  Theme ${ capitalizedName.bold } created with ID ${ response.id }` );
}

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
		const { domain, password } = utils.getAuth( command );

		// get original theme to have its name
		const originalTheme = await shopify.theme.get( id );
		const name = command.name || command.n || `Copy of ${ originalTheme.name }`;

		// create the new theme
		const newTheme = await shopify.theme.create( { name, role: 'unpublished' } );
		!command.json && console.log( `✅  New theme ${ name.bold } created.` );

		// get list of assets
		const assets = ( await shopify.asset.list( id ) ).map( a => a.key );

		// copy all the assets into the new theme
		await _sync( originalTheme, newTheme, assets, domain, password, command.json );

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
		const { domain, password } = utils.getAuth( command );

		// get original and target themes to have theirn names
		const sourceTheme = await shopify.theme.get( sourceId );
		const targetTheme = await shopify.theme.get( targetId );

		!command.json && console.log( 
`🔁  Syncing${ files.length > 0 ? ` ${ files.length } ` : ' ' }asset(s) \
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
		await _sync( sourceTheme, targetTheme, keysToCopy, domain, password, command.json );

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

async function _sync( sourceTheme, targetTheme, assetKeys, store, password, silent = false ) {
	!silent && console.log( `⌛️  Copying assets from source theme ${ sourceTheme.name.bold }...` );

	// if .sync dir already exists, either some other process is running
	// at the same time, or a prev process was interrupted.
	if ( fs.existsSync( './.sync' ) ) {
		if ( !promptDeletePrevSync() ) {
			throw new Error( 'Process aborted' );
		}
		// user accepted to delete dir
		await utils.rmdir( './.sync' );
	}

	// create swap dir
	fs.mkdirSync( './.sync' );

	// create temporary theme kit config file using our own
	// kit config command
	kit.writeConfig( [ sourceTheme, targetTheme ], store, password, './.sync' );

	// download files using theme kit nodejs api. Use .sync dir
	// as the temp.
	await themeKit.command( 'download', {
		dir: './.sync',
		password,
		store,
		themeid: sourceTheme.id,
		files: assetKeys,
		config: './.sync/config.yml',
		env: kit.sanitizeThemeName( sourceTheme.name ),
	});

	// upload files to target theme from sync dir.
	await themeKit.command( 'deploy', {
		password,
		store,
		themeid: targetTheme.id,
		dir: './.sync',
		nodelete: true,		
		config: './.sync/config.yml',
		env: kit.sanitizeThemeName( targetTheme.name ),
	});

	// clean up. Remove swap folder.
	utils.rmdir( './.sync' );
}

/**
 * Promps the user to confirm if they want to delete
 * the existing swap folder or not.
 * 
 * @return {Boolean}
 */
function promptDeletePrevSync() {
	return [ '', 'y' ].includes( utils.prompt( 
`A folder .sync already exists. This could mean another sync is in progress, or a previous sync was interrumpet.
Delete .sync folder? ` ).toLowerCase() );
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
		case 'bootstrap': return helpBootstrap();
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
✅  ${ 'Usage:'.bold } $ shopify-cli themes <action> [ params ] \
[ ( --domain | -d ) <domain> ( --key | -k ) \<api key> ( --password | -p ) <api password> ]

🙌  ${ 'Example:'.bold } $ shopify-cli themes list -d sample.myshopify.com \
-k 6570902bf65f43f36263as12asa63093 -p asdasd2345asd2345asd234a5sd234
	If you've run the config command before, then there's no need to use -d, -k, ...
   ${ 'Example:'.bold } $ shopify-cli themes list

👉  ${ 'Available actions:'.bold }

	- list 		Lists all themes
	- activate 	Activates a theme
	- rename 	Renames a theme
	- duplicate	Duplicates a theme
	- remove 	Removes a theme
	- upload 	Uploads a theme
	- sync 		Syncronizes files between two themes

🤓  ${ '#protip:'.bold.italic } Use --help with an action to get specific help for that action. \
i.e: $ shopify-cli themes list --help
	`
}

/**
 * Returns a string with help for the `bootstrap` action of this
 * module.
 * 
 * @return {String} 
 */
function helpBootstrap() {
	return `
✅  ${ 'Usage:'.bold } $ shopify-cli themes bootstrap ( <name> | --all ) [ ( --domain | -d ) <domain> ( --key | -k ) \
<api key> ( --password | -p ) <api password> ]

👉  ${ 'Available themes:'.bold }
	${ THEMES.join( ', ' ) } 

🙌  ${ 'Example:'.bold } $ shopify-cli themes bootstrap debut -d sample.myshopify.com -k 6570902bf65f43f36263as12asa63093 \
-p asdasd2345asd2345asd234a5sd234
	If you've run the config command before, then there's no need to use -d, -k, ...
   ${ 'Example:'.bold } $ shopify-cli themes bootstrap debut

👉  Use --all to install all themes
🙌  ${ 'Example:'.bold } $ shopify-cli themes bootstrap --all

🤓  ${ '#protip:'.bold.italic } Use --json to get a JSON output instead of the pretty one.
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
✅  ${ 'Usage:'.bold } $ shopify-cli themes list [ ( --domain | -d ) <domain> ( --key | -k ) \
<api key> ( --password | -p ) <api password> ]

🙌  ${ 'Example:'.bold } $ shopify-cli themes list -d sample.myshopify.com -k 6570902bf65f43f36263as12asa63093 \
-p asdasd2345asd2345asd234a5sd234
	If you've run the config command before, then there's no need to use -d, -k, ...
   ${ 'Example:'.bold } $ shopify-cli themes list

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
✅  ${ 'Usage:'.bold } $ shopify-cli themes activate <id> [ ( --domain | -d ) <domain> ( --key | -k ) \
<api key> ( --password | -p ) <api password> ]

🙌  ${ 'Example:'.bold } $ shopify-cli themes activate 129823982 -d sample.myshopify.com \
-k 6570902bf65f43f36263as12asa63093 -p asdasd2345asd2345asd234a5sd234
	If you've run the config command before, then there's no need to use -d, -k, ...
   ${ 'Example:'.bold } $ shopify-cli themes activate 129823982
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
✅  ${ 'Usage:'.bold } $ shopify-cli themes remove ( <id> | --all ) [ ( --domain | -d ) <domain> ( --key | -k ) \
<api key> ( --password | -p ) <api password> ]

🙌  ${ 'Example:'.bold } $ shopify-cli themes remove 123871292 -d sample.myshopify.com \
-k 6570902bf65f43f36263as12asa63093 -p asdasd2345asd2345asd234a5sd234
	If you've run the config command before, then there's no need to use -d, -k, ...
   ${ 'Example:'.bold } $ shopify-cli themes remove 123871292

   You can also remove ${ 'all'.bold.italic } themes by adding ${ '--all'.italic }.
   ${ 'Example:'.bold } $ shopify-cli themes remove all

   Removing all themes ${ 'will not'.bold } remove the active theme, as per Shopify restriction.
   Also, adding --all will ask for user confirmation. To skip confirmation prompt, add -y.
   ${ 'Example:'.bold } $ shopify-cli themes remove all -y

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
✅  ${ 'Usage:'.bold } $ shopify-cli themes duplicate <id> [ --name <name> ( --domain | -d ) <domain> \
( --key | -k ) <api key> ( --password | -p ) <api password> ]

👉  Available options:

	--name 		Name to use for the new Theme (optional)

🙌  ${ 'Example:'.bold } $ shopify-cli themes duplicate 123871292 --name "Duplicated theme" \
-d sample.myshopify.com -k 6570902bf65f43f36263as12asa63093 -p asdasd2345asd2345asd234a5sd234
	If you've run the config command before, then there's no need to use -d, -k, ...
   ${ 'Example:'.bold } $ shopify-cli themes duplicate 123871292 --name "Duplicated theme"

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
✅  ${ 'Usage:'.bold } $ shopify-cli themes rename <id> <name> [ ( --domain | -d ) \
<domain> ( --key | -k ) <api key> ( --password | -p ) <api password> ]

🙌  ${ 'Example:'.bold } $ shopify-cli themes rename 123871292 "New name" -d sample.myshopify.com \
-k 6570902bf65f43f36263as12asa63093 -p asdasd2345asd2345asd234a5sd234
	If you've run the config command before, then there's no need to use -d, -k, ...
   ${ 'Example:'.bold } $ shopify-cli themes rename 123871292 "New name"

🤓  ${ '#protip:'.bold.italic } --name can be used with this command to set the new name.
🤓  ${ '#superprotip:'.bold.italic } Use %name% and %id% as a template variables. They will be \
replaced with the value from the ${ 'old'.bold } theme.
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
✅  ${ 'Usage:'.bold } $ shopify-cli themes sync <id source> <id target> [ files ] \
[ ( --domain | -d ) <domain> ( --key | -k ) <api key> ( --password | -p ) <api password> ]

🙌  ${ 'Example:'.bold } $ shopify-cli themes sync 123871292 888279221 -d sample.myshopify.com \
-k 6570902bf65f43f36263as12asa63093 -p asdasd2345asd2345asd234a5sd234
	If you've run the config command before, then there's no need to use -d, -k, ...
   ${ 'Example:'.bold } $ shopify-cli themes sync 123871292 888279221

   You can also indicate which files you want to sync, like this:
   ${ 'Example:'.bold } $ shopify-cli themes sync 123871292 888279221 assets/main.js layouts/theme.liquid ...
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
✅  ${ 'Usage:'.bold } $ shopify-cli themes upload <id> [ ( --domain | -d ) <domain> ( --key | -k ) \
<api key> ( --password | -p ) <api password> ]

🙌  ${ 'Example:'.bold } $ shopify-cli themes upload 288929917 -d sample.myshopify.com \
-k 6570902bf65f43f36263as12asa63093 -p asdasd2345asd2345asd234a5sd234
	If you've run the config command before, then there's no need to use -d, -k, ...
   ${ 'Example:'.bold } $ shopify-cli themes upload 288929917
	`
}