/** Minimal static server with clean-URL support (mirrors production hosting). */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, normalize } from 'node:path';

const ROOT = dirname( fileURLToPath( import.meta.url ) );
const BASE_PORT = Number( process.env.PORT ) || 4321;
const MAX_TRIES = 10;
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.xml': 'application/xml', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };

const server = createServer( async ( req, res ) => {
	try {
		let p = decodeURIComponent( req.url.split( '?' )[ 0 ] );
		if ( p.endsWith( '/' ) ) { p += 'index.html'; }
		else if ( ! extname( p ) ) { p += '/index.html'; }
		const file = normalize( join( ROOT, p ) );
		if ( ! file.startsWith( ROOT ) ) { res.writeHead( 403 ).end( 'Forbidden' ); return; }
		const data = await readFile( file );
		res.writeHead( 200, { 'Content-Type': MIME[ extname( file ) ] || 'application/octet-stream' } );
		res.end( data );
	} catch {
		try {
			const fallback = normalize( join( ROOT, '404.html' ) );
			const data = await readFile( fallback );
			res.writeHead( 404, { 'Content-Type': 'text/html; charset=utf-8' } );
			res.end( data );
		} catch {
			res.writeHead( 404, { 'Content-Type': 'text/html' } );
			res.end( '<h1>404 — Not found</h1><p><a href="/">Home</a> · <a href="/tools/">All tools</a></p>' );
		}
	}
} );

function listen( port ) {
	return new Promise( ( resolve, reject ) => {
		const onError = ( err ) => {
			server.off( 'listening', onListening );
			if ( err.code === 'EADDRINUSE' && port < BASE_PORT + MAX_TRIES - 1 ) {
				console.warn( `Port ${ port } is in use — trying ${ port + 1 }…` );
				listen( port + 1 ).then( resolve ).catch( reject );
				return;
			}
			reject( err );
		};
		const onListening = () => {
			server.off( 'error', onError );
			console.log( `GlowMagazine running at http://localhost:${ port }` );
			resolve( port );
		};
		server.once( 'error', onError );
		server.once( 'listening', onListening );
		server.listen( port );
	} );
}

listen( BASE_PORT ).catch( ( err ) => {
	console.error( `Could not start server: ${ err.message }` );
	console.error( `Free port ${ BASE_PORT } or set PORT= e.g. PORT=4322 npm run serve` );
	process.exit( 1 );
} );
