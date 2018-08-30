require( 'dotenv' ).config();
const Shopify = require( 'shopify-api-node' );

exports.getShopify = function( command ) {
	const domain = command.d || command.domain || process.env.DOMAIN;
	const apiKey = command.k || command.key || process.env.KEY;
	const password = command.p || command.password || process.env.PASSWORD;
	const shopName = domain.replace( '.myshopify.com', '' ).replace( 'https://', '' );
	return new Shopify( { shopName, apiKey, password } );
}