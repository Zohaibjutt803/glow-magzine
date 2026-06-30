/** Shared .env loader for build scripts (local .env + process.env on Vercel/CI). */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname( fileURLToPath( import.meta.url ) );

export async function loadEnv() {
	try {
		const raw = await readFile( join( ROOT, '.env' ), 'utf8' );
		for ( const line of raw.split( /\r?\n/ ) ) {
			const m = line.match( /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/ );
			if ( ! m || line.trimStart().startsWith( '#' ) ) continue;
			let v = m[ 2 ].trim();
			if ( ( v.startsWith( '"' ) && v.endsWith( '"' ) ) || ( v.startsWith( "'" ) && v.endsWith( "'" ) ) ) v = v.slice( 1, -1 );
			if ( process.env[ m[ 1 ] ] === undefined ) process.env[ m[ 1 ] ] = v;
		}
	} catch { /* no .env */ }
}

export function analyticsHead( esc ) {
	const parts = [];
	const verify = process.env.GOOGLE_SITE_VERIFICATION;
	const ga = process.env.GA_MEASUREMENT_ID;
	if ( verify ) parts.push( `<meta name="google-site-verification" content="${ esc( verify ) }">` );
	if ( ga ) {
		parts.push( `<script async src="https://www.googletagmanager.com/gtag/js?id=${ esc( ga ) }"></script>` );
		parts.push( `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ esc( ga ) }');</script>` );
	}
	return parts.join( '\n' );
}
