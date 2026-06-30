/**
 * GlowMagazine static-site generator.
 * Reads tools-data.mjs and emits:
 *   /{slug}/index.html        one page per tool (clean URL)
 *   /tools/index.html         all-tools listing
 *   /tools/{category}/index.html  category pages
 *   /sitemap.xml              indexable URLs (homepage + live tools + categories)
 *   /assets/js/tools-index.js search index (window.GMT_TOOLS)
 *
 * Run:  node build.mjs
 */
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { SITE, CATEGORIES, TOOLS } from './tools-data.mjs';
import { fetchPosts } from './blog.mjs';

const ROOT = dirname( fileURLToPath( import.meta.url ) );
const ASSET_VER = '6'; // bump when CSS/JS change (busts the immutable /assets cache)
const esc = ( s = '' ) => String( s ).replace( /&/g, '&amp;' ).replace( /</g, '&lt;' ).replace( />/g, '&gt;' ).replace( /"/g, '&quot;' );
const isReady = ( t ) => !! t.handler;
const toolUrl = ( slug ) => `/${ slug }/`;
const catUrl = ( c ) => `/tools/${ c }/`;

/* ----------------------------- shared chrome ----------------------------- */
function head( { title, desc, canonical, jsonld } ) {
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${ esc( title ) }</title>
<meta name="description" content="${ esc( desc ) }">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="canonical" href="${ SITE.url }${ canonical }">
<meta property="og:title" content="${ esc( title ) }">
<meta property="og:description" content="${ esc( desc ) }">
<meta property="og:type" content="website">
<meta property="og:url" content="${ SITE.url }${ canonical }">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,400..700,0..1,0&display=block" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/style.css?v=${ ASSET_VER }">
<link rel="stylesheet" href="/assets/css/tool.css?v=${ ASSET_VER }">
${ jsonld ? `<script type="application/ld+json">${ JSON.stringify( jsonld ) }</script>` : '' }
</head>
<body>`;
}

const HEADER = `
<div class="announce"><div class="announce__inner">
<div class="announce__left"><span>🎁</span><span>100% FREE Tools • No Sign Up • Instant Results</span></div>
<nav class="announce__links"><a href="/">About Us</a><a href="/">Contact</a><a href="/">Privacy Policy</a><a href="/">Disclaimer</a></nav>
</div></div>
<header class="header" id="header"><nav class="nav">
<div class="nav__left">
<a href="/" class="logo" aria-label="Glow Magazine home"><span class="logo__mark">Glow</span><span class="logo__sub">Magazine</span></a>
<div class="menu"><a href="/">Home</a><a href="/tools/">Tools</a><a href="/tools/">Categories</a><a href="/blog/">Blog</a><a href="/">About Us</a><a href="/">Contact</a></div>
</div>
<div class="nav__right">
<a href="/tools/" class="btn btn--primary btn--pill"><span class="material-symbols-outlined">apps</span> Explore Tools</a>
<button class="nav__toggle" id="navToggle" aria-label="Open menu" aria-expanded="false"><span class="material-symbols-outlined">menu</span></button>
</div>
</nav>
<div class="mobile-menu" id="mobileMenu"><a href="/">Home</a><a href="/tools/">Tools</a><a href="/tools/">Categories</a><a href="/blog/">Blog</a><a href="/">About Us</a><a href="/">Contact</a></div>
</header>`;

const FOOTER = `
<footer class="footer"><div class="container">
<div class="footer__grid">
<div class="footer__brand">
<a href="/" class="logo"><span class="logo__mark">Glow</span><span class="logo__sub">Magazine</span></a>
<p class="footer__about">Your one-stop destination for free online tools, calculators, converters and generators. Fast, simple, and 100% free forever.</p>
<div class="footer__social"><a href="/" aria-label="Website"><span class="material-symbols-outlined">public</span></a><a href="/" aria-label="Email"><span class="material-symbols-outlined">alternate_email</span></a><a href="/" aria-label="Share"><span class="material-symbols-outlined">share</span></a></div>
</div>
<div class="footer__col"><h4>Quick Links</h4><ul><li><a href="/">Home</a></li><li><a href="/tools/">All Tools</a></li><li><a href="/tools/">Categories</a></li><li><a href="/blog/">Blog</a></li></ul></div>
<div class="footer__col"><h4>Categories</h4><ul>${ Object.entries( CATEGORIES ).map( ( [ k, c ] ) => `<li><a href="${ catUrl( k ) }">${ esc( c.name ) }</a></li>` ).join( '' ) }</ul></div>
<div class="footer__col"><h4>Popular Tools</h4><ul>${ TOOLS.filter( isReady ).slice( 0, 5 ).map( ( t ) => `<li><a href="${ toolUrl( t.slug ) }">${ esc( t.name ) }</a></li>` ).join( '' ) }</ul></div>
<div class="footer__col"><h4>Legal</h4><ul><li><a href="/">Privacy Policy</a></li><li><a href="/">Terms of Use</a></li><li><a href="/">Disclaimer</a></li><li><a href="/">Cookie Policy</a></li></ul></div>
</div>
<div class="footer__bottom"><p>© ${ new Date().getFullYear() } Glow Magazine. All Rights Reserved.</p><p>Made with <span class="heart">❤</span> for Everyone</p></div>
</div></footer>
<script src="/assets/js/main.js?v=${ ASSET_VER }"></script>`;

const searchBox = `<div class="tool-search" data-gmt="search"><input type="search" placeholder="Search tools…" data-gmt="search-input" aria-label="Search tools"><ul class="tool-search__results" data-gmt="search-results" role="listbox" hidden></ul></div>`;

function toolCard( t ) {
	const soon = isReady( t ) ? '' : ' tool-card--soon';
	const badge = isReady( t ) ? '' : `<span class="tool-card__badge">Coming soon</span>`;
	return `<a class="tool-card${ soon }" href="${ toolUrl( t.slug ) }">
<div class="tool-card__ico" style="background:var(--primary-fixed);color:var(--primary)"><span class="material-symbols-outlined">${ t.icon }</span></div>
<h3>${ esc( t.name ) }</h3>
<p>${ esc( ( t.intro || t.meta || '' ).slice( 0, 80 ) ) }…</p>
${ badge || '<span class="tool-card__link">Use now <span class="material-symbols-outlined">arrow_forward</span></span>' }
</a>`;
}

/* ------------------------------- ad slot ------------------------------- */
const ad = ( where ) => `<div class="gmt-ad gmt-ad--${ where }"><span class="gmt-ad__label">Advertisement</span><div class="gmt-ad__box"><!-- AdSense ${ where } slot --></div></div>`;

/* ------------------------------ tool page ------------------------------ */
function toolPage( t ) {
	const cat = CATEGORIES[ t.category ];
	const ready = isReady( t );
	const related = TOOLS.filter( ( x ) => x.category === t.category && x.slug !== t.slug ).sort( ( a, b ) => ( isReady( b ) - isReady( a ) ) ).slice( 0, 6 );

	const graph = [
		{ '@type': 'BreadcrumbList', itemListElement: [
			{ '@type': 'ListItem', position: 1, name: 'Home', item: SITE.url + '/' },
			{ '@type': 'ListItem', position: 2, name: 'Tools', item: SITE.url + '/tools/' },
			{ '@type': 'ListItem', position: 3, name: cat.name, item: SITE.url + catUrl( t.category ) },
			{ '@type': 'ListItem', position: 4, name: t.name, item: SITE.url + toolUrl( t.slug ) }
		] },
		{ '@type': 'WebApplication', name: t.name, url: SITE.url + toolUrl( t.slug ), applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, description: t.meta }
	];
	if ( t.faqs && t.faqs.length ) {
		graph.push( { '@type': 'FAQPage', mainEntity: t.faqs.map( ( f ) => ( { '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } } ) ) } );
	}

	const widget = ready
		? `<div class="tool gmt-tool" data-handler="${ t.handler }" data-slug="${ t.slug }">
<div data-gmt="form"><div class="tool__loading" data-gmt="loading">Loading tool…</div><noscript><p class="gmt-notice">This tool needs JavaScript enabled.</p></noscript></div>
${ ad( 'before_result' ) }
<div data-gmt="result" aria-live="polite"></div>
${ ad( 'below_result' ) }
</div>`
		: `<div class="tool"><p class="gmt-notice">🚧 This calculator is being built and will be live shortly. In the meantime, explore the related tools below.</p></div>`;

	const faqHtml = ( t.faqs && t.faqs.length )
		? `<section class="tool-section"><h2>Frequently Asked Questions</h2>${ t.faqs.map( ( f ) => `<details class="faq__item"><summary>${ esc( f.q ) }</summary><div class="faq__answer">${ esc( f.a ) }</div></details>` ).join( '' ) }</section>`
		: '';

	const relatedHtml = related.length
		? `<section class="tool-section"><h2>Related ${ esc( cat.name ) } Tools</h2><div class="tools-grid">${ related.map( toolCard ).join( '' ) }</div></section>`
		: '';

	const scripts = ready
		? `<script src="/assets/js/tool-runtime.js?v=${ ASSET_VER }"></script>\n<script src="/assets/js/tools-index.js?v=${ ASSET_VER }"></script>\n<script src="/assets/js/tools/${ t.handler }.js?v=${ ASSET_VER }"></script>`
		: `<script src="/assets/js/tool-runtime.js?v=${ ASSET_VER }"></script>\n<script src="/assets/js/tools-index.js?v=${ ASSET_VER }"></script>`;

	const robots = ready ? '' : '<meta name="robots" content="noindex,follow">';

	return head( { title: t.title, desc: t.meta, canonical: toolUrl( t.slug ), jsonld: { '@context': 'https://schema.org', '@graph': graph } } ).replace( '</head>', `${ robots }\n</head>` )
		+ HEADER
		+ `<main><div class="page">
<ol class="crumbs"><li><a href="/">Home</a></li><li><a href="/tools/">Tools</a></li><li><a href="${ catUrl( t.category ) }">${ esc( cat.name ) }</a></li><li><span aria-current="page">${ esc( t.name ) }</span></li></ol>
<header class="tool-head">
<a class="eyebrow" href="${ catUrl( t.category ) }">${ esc( cat.name ) }</a>
<h1 class="tool-head__title"><span class="tool-head__ico"><span class="material-symbols-outlined">${ t.icon }</span></span> ${ esc( t.name ) }</h1>
${ t.intro ? `<p class="tool-head__intro">${ esc( t.intro ) }</p>` : '' }
</header>
${ ad( 'below_heading' ) }
${ widget }
${ relatedHtml }
${ faqHtml }
<section class="tool-section"><h2>Find another tool</h2>${ searchBox }</section>
</div></main>`
		+ FOOTER + scripts + `\n</body></html>`;
}

/* ------------------------------ listing page ------------------------------ */
function listingPage() {
	const blocks = Object.entries( CATEGORIES ).map( ( [ key, cat ] ) => {
		const items = TOOLS.filter( ( t ) => t.category === key );
		if ( ! items.length ) return '';
		return `<div class="cat-block"><h2 class="cat-block__title"><span class="material-symbols-outlined">${ cat.icon }</span> <a href="${ catUrl( key ) }">${ esc( cat.name ) }</a></h2><div class="tools-grid">${ items.map( toolCard ).join( '' ) }</div></div>`;
	} ).join( '' );

	return head( { title: 'All Free Online Tools & Calculators | Glow Magazine', desc: 'Browse all 50+ free, fast and mobile-friendly online tools and calculators for health, beauty, finance and everyday life.', canonical: '/tools/' } )
		+ HEADER
		+ `<main><div class="page page--wide">
<ol class="crumbs"><li><a href="/">Home</a></li><li><span aria-current="page">Tools</span></li></ol>
<header class="page-head"><span class="eyebrow">All Free Tools</span><h1>Free Online Tools &amp; Calculators</h1><p>Fast, free and mobile-friendly tools for health, beauty, finance and everyday life. No sign-up required.</p></header>
${ searchBox }
${ blocks }
</div></main>`
		+ FOOTER + `<script src="/assets/js/tool-runtime.js?v=${ ASSET_VER }"></script>\n<script src="/assets/js/tools-index.js?v=${ ASSET_VER }"></script>\n</body></html>`;
}

/* ----------------------------- category page ----------------------------- */
function categoryPage( key, cat ) {
	const items = TOOLS.filter( ( t ) => t.category === key );
	return head( { title: `${ cat.name } Tools — Free & Instant | Glow Magazine`, desc: cat.blurb, canonical: catUrl( key ) } )
		+ HEADER
		+ `<main><div class="page page--wide">
<ol class="crumbs"><li><a href="/">Home</a></li><li><a href="/tools/">Tools</a></li><li><span aria-current="page">${ esc( cat.name ) }</span></li></ol>
<header class="page-head"><span class="eyebrow">Category</span><h1>${ esc( cat.name ) } Tools</h1><p>${ esc( cat.blurb ) }</p></header>
${ searchBox }
<div class="tools-grid">${ items.map( toolCard ).join( '' ) }</div>
</div></main>`
		+ FOOTER + `<script src="/assets/js/tool-runtime.js?v=${ ASSET_VER }"></script>\n<script src="/assets/js/tools-index.js?v=${ ASSET_VER }"></script>\n</body></html>`;
}

/* --------------------------------- blog --------------------------------- */
const postUrl = ( slug ) => `/blog/${ slug }/`;

function postCard( p ) {
	const media = p.cover
		? `<div class="post__media"><img src="${ esc( p.cover ) }" alt="${ esc( p.coverAlt ) }" loading="lazy"></div>`
		: '';
	return `<article class="post">
${ media }
<div class="post__body">
<div class="post__meta"><span class="badge ${ p.tint }">${ esc( p.category ) }</span><span class="post__date">${ esc( p.date ) }</span></div>
<h3><a href="${ postUrl( p.slug ) }">${ esc( p.title ) }</a></h3>
<p class="post__excerpt">${ esc( p.excerpt ) }</p>
<a href="${ postUrl( p.slug ) }" class="post__link">Read More <span class="material-symbols-outlined">arrow_forward</span></a>
</div>
</article>`;
}

function blogListingPage( posts ) {
	return head( { title: 'Blog — Articles, Tips & Guides | Glow Magazine', desc: 'Read the latest articles, tips and guides from Glow Magazine on health, beauty, finance and everyday productivity.', canonical: '/blog/' } )
		+ HEADER
		+ `<main><div class="page page--wide">
<ol class="crumbs"><li><a href="/">Home</a></li><li><span aria-current="page">Blog</span></li></ol>
<header class="page-head"><span class="eyebrow">From Our Blog</span><h1>Articles &amp; Guides</h1><p>Tips, guides and insights to help you get more out of our free tools.</p></header>
<div class="blog-grid">${ posts.map( postCard ).join( '' ) }</div>
</div></main>`
		+ FOOTER + `<script src="/assets/js/main.js?v=${ ASSET_VER }"></script>\n</body></html>`;
}

function blogPostPage( p, posts ) {
	const related = posts.filter( ( x ) => x.slug !== p.slug ).slice( 0, 3 );
	const graph = [
		{ '@type': 'BreadcrumbList', itemListElement: [
			{ '@type': 'ListItem', position: 1, name: 'Home', item: SITE.url + '/' },
			{ '@type': 'ListItem', position: 2, name: 'Blog', item: SITE.url + '/blog/' },
			{ '@type': 'ListItem', position: 3, name: p.title, item: SITE.url + postUrl( p.slug ) }
		] },
		{ '@type': 'BlogPosting', headline: p.title, description: p.seoDescription, image: p.cover || undefined,
		  datePublished: p.iso, dateModified: p.iso, mainEntityOfPage: SITE.url + postUrl( p.slug ),
		  author: { '@type': 'Organization', name: SITE.name }, publisher: { '@type': 'Organization', name: SITE.name } }
	];

	const hero = p.cover ? `<div class="article__hero"><img src="${ esc( p.cover ) }" alt="${ esc( p.coverAlt ) }"></div>` : '';
	const relatedHtml = related.length
		? `<section class="tool-section"><h2>More from the blog</h2><div class="blog-grid">${ related.map( postCard ).join( '' ) }</div></section>`
		: '';

	return head( { title: p.seoTitle, desc: p.seoDescription, canonical: postUrl( p.slug ), jsonld: { '@context': 'https://schema.org', '@graph': graph } } )
		+ HEADER
		+ `<main><div class="page">
<ol class="crumbs"><li><a href="/">Home</a></li><li><a href="/blog/">Blog</a></li><li><span aria-current="page">${ esc( p.title ) }</span></li></ol>
<header class="tool-head">
<span class="eyebrow"><span class="badge ${ p.tint }">${ esc( p.category ) }</span> ${ esc( p.date ) }</span>
<h1 class="tool-head__title">${ esc( p.title ) }</h1>
${ p.excerpt ? `<p class="tool-head__intro">${ esc( p.excerpt ) }</p>` : '' }
</header>
${ hero }
${ ad( 'below_heading' ) }
<article class="article">${ p.bodyHtml }</article>
${ ad( 'below_result' ) }
${ relatedHtml }
</div></main>`
		+ FOOTER + `<script src="/assets/js/main.js?v=${ ASSET_VER }"></script>\n</body></html>`;
}

/* Inject the latest posts into the homepage blog grid (between markers). */
async function patchHomepageBlog( posts ) {
	const file = join( ROOT, 'index.html' );
	let html;
	try { html = await readFile( file, 'utf8' ); } catch { return; }
	const START = '<!-- BLOG:START -->', END = '<!-- BLOG:END -->';
	const a = html.indexOf( START ), b = html.indexOf( END );
	if ( a === -1 || b === -1 ) { console.warn( '⚠ Homepage blog markers not found — skipped homepage injection.' ); return; }
	const cards = posts.slice( 0, 4 ).map( postCard ).join( '\n' );
	const next = html.slice( 0, a + START.length ) + '\n' + cards + '\n\t\t\t' + html.slice( b );
	if ( next !== html ) { await writeFile( file, next, 'utf8' ); console.log( '✓ Homepage blog grid updated from Contentful.' ); }
}

/* -------------------------------- sitemap -------------------------------- */
function sitemap( posts ) {
	const urls = [ '/', '/tools/' ]
		.concat( Object.keys( CATEGORIES ).map( catUrl ) )
		.concat( TOOLS.filter( isReady ).map( ( t ) => toolUrl( t.slug ) ) )
		.concat( posts.length ? [ '/blog/' ] : [] )
		.concat( posts.map( ( p ) => postUrl( p.slug ) ) );
	const body = urls.map( ( u ) => `  <url><loc>${ SITE.url }${ u }</loc></url>` ).join( '\n' );
	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${ body }\n</urlset>\n`;
}

/* --------------------------------- build --------------------------------- */
async function out( rel, content ) {
	const file = join( ROOT, rel );
	await mkdir( dirname( file ), { recursive: true } );
	await writeFile( file, content, 'utf8' );
}

async function build() {
	let n = 0;
	for ( const t of TOOLS ) { await out( join( t.slug, 'index.html' ), toolPage( t ) ); n++; }
	await out( join( 'tools', 'index.html' ), listingPage() );
	for ( const [ key, cat ] of Object.entries( CATEGORIES ) ) { await out( join( 'tools', key, 'index.html' ), categoryPage( key, cat ) ); }

	/* ------------------------------- blog -------------------------------- */
	const posts = await fetchPosts();
	if ( posts.length ) {
		await out( join( 'blog', 'index.html' ), blogListingPage( posts ) );
		for ( const p of posts ) { await out( join( 'blog', p.slug, 'index.html' ), blogPostPage( p, posts ) ); }
		await patchHomepageBlog( posts );
	}

	await out( 'sitemap.xml', sitemap( posts ) );

	const index = TOOLS.map( ( t ) => ( { slug: t.slug, name: t.name, category: CATEGORIES[ t.category ].name, icon: t.icon, url: toolUrl( t.slug ) } ) );
	await out( join( 'assets', 'js', 'tools-index.js' ), 'window.GMT_TOOLS = ' + JSON.stringify( index ) + ';\n' );

	console.log( `✓ Generated ${ n } tool pages, ${ Object.keys( CATEGORIES ).length } category pages, listing + sitemap.` );
	console.log( `✓ Live calculators: ${ TOOLS.filter( isReady ).length } / ${ TOOLS.length }` );
	console.log( `✓ Blog pages: ${ posts.length ? posts.length + ' post(s) + listing' : 'none (static placeholder kept)' }` );
}
build().catch( ( e ) => { console.error( e ); process.exit( 1 ); } );
