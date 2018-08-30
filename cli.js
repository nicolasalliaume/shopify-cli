#!/usr/bin/env node

const argv = [ ...process.argv ].splice( 2 );

( async function() {

	const command = parse( argv );

	if ( command.v || command.version ) return console.log( 'v1.0.0' );

	// get action (first inline)
	const action = command[ '__' ][ 0 ];

	switch ( action ) {

		case 'config': return await require( './config' )( command );

		case 'themes': 
		case 'theme': return await require( './theme' )( command );

		default: return console.log( '❌  Error: Command not recognized. ' + help() );
	}

} () );


function parse( argv ) {
	const result = { };
	let currentKey = null;

	for ( var i = 0; i < argv.length; i++ ) {
		let arg = argv[ i ];
		
		// Found new flag / param
		if ( arg.startsWith( '-' ) ) {
			// if no value for prev arg, then it's
			// a flag. Close prev and set up new flag / param
			if ( currentKey ) {
				result[ currentKey ] = true;
				currentKey = null;
			}
			arg = arg.replace(/-/g, '');
			result[ arg ] = true;
			currentKey = arg;
		}
		// Working on a key already. Get value and
		// finish this key.
		else if ( currentKey ) {
			result[ currentKey ] = arg;
			currentKey = null;
		}
		// No prev param to complete, and this is not
		// a flag. So it's either the action we wanna do
		// or some non-flagged param. Using special key "__"
		// for this.
		else {
			if ( result[ '__' ] == undefined ) result[ '__' ] = [];
			result[ '__' ].push( arg );
			// make sure we reset the current key so we don't assign
			// other inline parameters (non-flagged) to prev flags
			currentKey = null;
		}
	}

	return result;
}

process.on( 'unhandledRejection', (reason, p) => { 
	console.error( reason );
	console.error( p ); 
} );

/**
 * Returns string with command line help
 * 
 * @return {String} 
 */
function help() {
	return `
✅  Usage: $ node index.js [ -flags ] [ action ] [ params ]
 
👉  Available flags:
	
	-v, --version 		See version
	-d, --domain 		Domain
	-k, --key 		API key
	-p, --password 		API password
	--json 			Outputs result in JSON format 

👉  Available actions:

	themes, theme 		Theme operations
	config 		Save domain, key and password
	`
}