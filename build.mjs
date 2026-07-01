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
import { fetchBlogData } from './blog.mjs';
import { STATIC_PAGES } from './static-pages.mjs';
import { BLOG_CATEGORIES } from './blog-categories.mjs';
import { loadEnv, analyticsHead } from './env.mjs';

const ROOT = dirname( fileURLToPath( import.meta.url ) );
const ASSET_VER = '11';
let HEAD_EXTRAS = '';
const esc = ( s = '' ) => String( s ).replace( /&/g, '&amp;' ).replace( /</g, '&lt;' ).replace( />/g, '&gt;' ).replace( /"/g, '&quot;' );
const isReady = ( t ) => !! t.handler;
const toolUrl = ( slug ) => `/${ slug }/`;
const catUrl = ( c ) => `/tools/${ c }/`;
const staticUrl = ( slug ) => `/${ slug }/`;
const postUrl = ( slug ) => `/blog/${ slug }/`;
const blogCatUrl = ( slug ) => `/category/${ slug }/`;
const authorUrl = ( slug ) => `/author/${ slug }/`;
const tagUrl = ( slug ) => `/tag/${ slug }/`;

/* ----------------------------- shared chrome ----------------------------- */
function resolveCanonical( path, override = '' ) {
	const raw = String( override || '' ).trim();
	if ( raw ) {
		if ( /^https?:\/\//i.test( raw ) ) return raw;
		return SITE.url + ( raw.startsWith( '/' ) ? raw : `/${ raw }` );
	}
	return SITE.url + path;
}

function mergeSchemaGraph( autoGraph, extra ) {
	if ( ! extra ) return { '@context': 'https://schema.org', '@graph': autoGraph };
	try {
		const custom = typeof extra === 'string' ? JSON.parse( extra ) : extra;
		if ( custom?.[ '@graph' ] ) {
			return { '@context': 'https://schema.org', '@graph': [ ...autoGraph, ...custom[ '@graph' ] ] };
		}
		if ( Array.isArray( custom ) ) {
			return { '@context': 'https://schema.org', '@graph': [ ...autoGraph, ...custom ] };
		}
		return { '@context': 'https://schema.org', '@graph': [ ...autoGraph, custom ] };
	} catch {
		return { '@context': 'https://schema.org', '@graph': autoGraph };
	}
}

function head( { title, desc, canonical, canonicalUrl, keywords, ogTitle, ogDesc, ogType, ogImage, twitterCard, jsonld } ) {
	const canon = resolveCanonical( canonical, canonicalUrl );
	const socialTitle = ogTitle || title;
	const socialDesc = ogDesc || desc;
	const type = ogType || 'website';
	const card = twitterCard || ( ogImage ? 'summary_large_image' : 'summary' );
	const keywordsTag = keywords ? `<meta name="keywords" content="${ esc( keywords ) }">\n` : '';
	const imageTags = ogImage
		? `<meta property="og:image" content="${ esc( ogImage ) }">\n<meta name="twitter:image" content="${ esc( ogImage ) }">\n`
		: '';
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${ esc( title ) }</title>
<meta name="description" content="${ esc( desc ) }">
${ keywordsTag }<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="canonical" href="${ esc( canon ) }">
<meta property="og:title" content="${ esc( socialTitle ) }">
<meta property="og:description" content="${ esc( socialDesc ) }">
<meta property="og:type" content="${ esc( type ) }">
<meta property="og:url" content="${ esc( canon ) }">
<meta property="og:site_name" content="${ esc( SITE.name ) }">
${ imageTags }<meta name="twitter:card" content="${ esc( card ) }">
<meta name="twitter:title" content="${ esc( socialTitle ) }">
<meta name="twitter:description" content="${ esc( socialDesc ) }">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,400..700,0..1,0&display=block" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/style.css?v=${ ASSET_VER }">
<link rel="stylesheet" href="/assets/css/tool.css?v=${ ASSET_VER }">
<link rel="alternate" type="application/rss+xml" title="${ esc( SITE.name ) } RSS" href="${ SITE.url }/feed.xml">
${ HEAD_EXTRAS }
${ jsonld ? `<script type="application/ld+json">${ JSON.stringify( jsonld ) }</script>` : '' }
</head>
<body>`;
}

const LOGO = `<a href="/" class="logo" aria-label="${ esc( SITE.name ) } home"><span class="logo__mark">Glow</span><span class="logo__sub">Magzine</span></a>`;

const HEADER = `
<div class="announce"><div class="announce__inner">
<div class="announce__left"><span>✨</span><span>${ esc( SITE.tagline ) }</span></div>
<nav class="announce__links"><a href="${ staticUrl( 'about' ) }">About Us</a><a href="${ staticUrl( 'contact' ) }">Contact</a><a href="${ staticUrl( 'privacy-policy' ) }">Privacy Policy</a><a href="${ staticUrl( 'disclaimer' ) }">Disclaimer</a></nav>
</div></div>
<header class="header" id="header"><nav class="nav">
<div class="nav__left">
${ LOGO }
<div class="menu"><a href="/">Home</a><a href="/tools/">Tools</a><a href="/tools/">Categories</a><a href="/blog/">Blog</a><a href="${ staticUrl( 'about' ) }">About Us</a><a href="${ staticUrl( 'contact' ) }">Contact</a></div>
</div>
<div class="nav__right">
<form class="search" action="/search/" method="get" role="search">
<input type="search" name="q" placeholder="Search tools, articles…" aria-label="Search">
<span class="material-symbols-outlined">search</span>
</form>
<a href="/tools/" class="btn btn--primary btn--pill"><span class="material-symbols-outlined">apps</span> Explore Tools</a>
<button class="nav__toggle" id="navToggle" aria-label="Open menu" aria-expanded="false"><span class="material-symbols-outlined">menu</span></button>
</div>
</nav>
<div class="mobile-menu" id="mobileMenu"><a href="/">Home</a><a href="/tools/">Tools</a><a href="/tools/">Categories</a><a href="/blog/">Blog</a><a href="${ staticUrl( 'about' ) }">About Us</a><a href="${ staticUrl( 'contact' ) }">Contact</a></div>
</header>`;

const FOOTER = `
<footer class="footer"><div class="container">
<div class="footer__grid">
<div class="footer__brand">
${ LOGO }
<p class="footer__about">${ esc( SITE.footer ) }</p>
<div class="footer__social"><a href="/" aria-label="Website"><span class="material-symbols-outlined">public</span></a><a href="${ staticUrl( 'contact' ) }" aria-label="Email"><span class="material-symbols-outlined">alternate_email</span></a><a href="/tools/" aria-label="Tools"><span class="material-symbols-outlined">apps</span></a></div>
</div>
<div class="footer__col"><h4>Quick Links</h4><ul><li><a href="/">Home</a></li><li><a href="/tools/">All Tools</a></li><li><a href="/tools/">Categories</a></li><li><a href="/blog/">Blog</a></li><li><a href="${ staticUrl( 'about' ) }">About Us</a></li><li><a href="${ staticUrl( 'contact' ) }">Contact</a></li></ul></div>
<div class="footer__col"><h4>Categories</h4><ul>${ Object.entries( CATEGORIES ).map( ( [ k, c ] ) => `<li><a href="${ catUrl( k ) }">${ esc( c.name ) }</a></li>` ).join( '' ) }</ul></div>
<div class="footer__col"><h4>Popular Tools</h4><ul>${ TOOLS.filter( isReady ).slice( 0, 5 ).map( ( t ) => `<li><a href="${ toolUrl( t.slug ) }">${ esc( t.name ) }</a></li>` ).join( '' ) }</ul></div>
<div class="footer__col"><h4>Guides</h4><ul>${ BLOG_CATEGORIES.slice( 0, 6 ).map( ( c ) => `<li><a href="${ blogCatUrl( c.slug ) }">${ esc( c.name ) }</a></li>` ).join( '' ) }</ul></div>
<div class="footer__col"><h4>Legal</h4><ul><li><a href="${ staticUrl( 'privacy-policy' ) }">Privacy Policy</a></li><li><a href="${ staticUrl( 'terms-of-use' ) }">Terms of Use</a></li><li><a href="${ staticUrl( 'editorial-policy' ) }">Editorial Policy</a></li><li><a href="${ staticUrl( 'disclaimer' ) }">Disclaimer</a></li><li><a href="${ staticUrl( 'cookie-policy' ) }">Cookie Policy</a></li></ul></div>
</div>
<div class="footer__bottom"><p>© ${ new Date().getFullYear() } ${ esc( SITE.name ) }. All Rights Reserved.</p><p>Made with <span class="heart">❤</span> for Everyone</p></div>
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

	return head( { title: `All Free Online Tools & Calculators | ${ SITE.name }`, desc: 'Browse all 50+ free, fast and mobile-friendly online tools and calculators for health, beauty, finance and everyday life.', canonical: '/tools/' } )
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
	return head( { title: `${ cat.name } Tools — Free & Instant | ${ SITE.name }`, desc: cat.blurb, canonical: catUrl( key ) } )
		+ HEADER
		+ `<main><div class="page page--wide">
<ol class="crumbs"><li><a href="/">Home</a></li><li><a href="/tools/">Tools</a></li><li><span aria-current="page">${ esc( cat.name ) }</span></li></ol>
<header class="page-head"><span class="eyebrow">Category</span><h1>${ esc( cat.name ) } Tools</h1><p>${ esc( cat.blurb ) }</p></header>
${ searchBox }
<div class="tools-grid">${ items.map( toolCard ).join( '' ) }</div>
</div></main>`
		+ FOOTER + `<script src="/assets/js/tool-runtime.js?v=${ ASSET_VER }"></script>\n<script src="/assets/js/tools-index.js?v=${ ASSET_VER }"></script>\n</body></html>`;
}

/* ----------------------------- static pages ----------------------------- */
function staticPage( p ) {
	const path = staticUrl( p.slug );
	const graph = [
		{ '@type': 'BreadcrumbList', itemListElement: [
			{ '@type': 'ListItem', position: 1, name: 'Home', item: SITE.url + '/' },
			{ '@type': 'ListItem', position: 2, name: p.name, item: SITE.url + path }
		] },
		{ '@type': 'WebPage', name: p.title, description: p.desc, url: SITE.url + path }
	];
	return head( { title: p.title, desc: p.desc, canonical: path, jsonld: { '@context': 'https://schema.org', '@graph': graph } } )
		+ HEADER
		+ `<main><div class="page">
<ol class="crumbs"><li><a href="/">Home</a></li><li><span aria-current="page">${ esc( p.name ) }</span></li></ol>
<header class="page-head"><h1>${ esc( p.name ) }</h1></header>
<article class="article">${ p.body }</article>
</div></main>`
		+ FOOTER + `\n</body></html>`;
}

function robotsTxt() {
	return `User-agent: *\nAllow: /\n\nSitemap: ${ SITE.url }/sitemap.xml\n`;
}

/* --------------------------------- blog --------------------------------- */

function mergeBlogCategories( posts, cfCategories ) {
	const map = new Map( BLOG_CATEGORIES.map( ( c ) => [ c.slug, { ...c } ] ) );
	for ( const c of cfCategories ) map.set( c.slug, { ...map.get( c.slug ), ...c } );
	for ( const p of posts ) {
		if ( ! map.has( p.categorySlug ) ) {
			map.set( p.categorySlug, {
				slug: p.categorySlug,
				name: p.categoryName,
				title: `${ p.categoryName } Articles | ${ SITE.name }`,
				desc: `Read ${ p.categoryName } articles, tips and guides on ${ SITE.name }.`,
				blurb: `Articles about ${ p.categoryName }.`,
				toolCategory: '',
			} );
		}
	}
	return [ ...map.values() ].sort( ( a, b ) => a.name.localeCompare( b.name ) );
}

function mergeTags( posts, cfTags ) {
	const map = new Map( cfTags.map( ( t ) => [ t.slug, { ...t } ] ) );
	for ( const p of posts ) {
		for ( const t of p.tags || [] ) {
			if ( ! map.has( t.slug ) ) map.set( t.slug, t );
		}
	}
	return [ ...map.values() ].sort( ( a, b ) => a.name.localeCompare( b.name ) );
}

function mergeAuthors( posts, cfAuthors ) {
	const map = new Map( cfAuthors.map( ( a ) => [ a.slug, { ...a } ] ) );
	for ( const p of posts ) {
		if ( p.author && ! map.has( p.author.slug ) ) map.set( p.author.slug, p.author );
	}
	return [ ...map.values() ].sort( ( a, b ) => a.name.localeCompare( b.name ) );
}

function relatedPosts( post, posts, limit = 5 ) {
	return posts
		.filter( ( x ) => x.slug !== post.slug && x.categorySlug === post.categorySlug )
		.slice( 0, limit );
}

function relatedToolsForPost( post, blogCat ) {
	const picked = ( post.relatedTools || [] )
		.map( ( s ) => TOOLS.find( ( t ) => t.slug === s ) )
		.filter( Boolean );
	if ( picked.length ) return picked.slice( 0, 3 );
	const key = blogCat?.toolCategory;
	if ( key ) return TOOLS.filter( ( t ) => t.category === key && isReady( t ) ).slice( 0, 3 );
	return TOOLS.filter( isReady ).slice( 0, 3 );
}

function postCard( p ) {
	const media = p.cover
		? `<div class="post__media"><img src="${ esc( p.cover ) }" alt="${ esc( p.coverAlt ) }" loading="lazy"></div>`
		: '';
	return `<article class="post">
${ media }
<div class="post__body">
<div class="post__meta"><a href="${ blogCatUrl( p.categorySlug ) }" class="badge ${ p.tint }">${ esc( p.categoryName ) }</a><span class="post__date">${ esc( p.date ) }</span></div>
<h3><a href="${ postUrl( p.slug ) }">${ esc( p.title ) }</a></h3>
<p class="post__excerpt">${ esc( p.excerpt ) }</p>
<a href="${ postUrl( p.slug ) }" class="post__link">Read More <span class="material-symbols-outlined">arrow_forward</span></a>
</div>
</article>`;
}

function blogListingPage( posts, categories ) {
	const catNav = categories.length
		? `<nav class="archive-nav" aria-label="Blog categories">${ categories.map( ( c ) => `<a href="${ blogCatUrl( c.slug ) }">${ esc( c.name ) }</a>` ).join( '' ) }</nav>`
		: '';
	return head( { title: `Blog — Articles, Tips & Guides | ${ SITE.name }`, desc: `Read the latest articles, tips and guides from ${ SITE.name } on health, beauty, finance and everyday productivity.`, canonical: '/blog/' } )
		+ HEADER
		+ `<main><div class="page page--wide">
<ol class="crumbs"><li><a href="/">Home</a></li><li><span aria-current="page">Blog</span></li></ol>
<header class="page-head"><span class="eyebrow">From Our Blog</span><h1>Articles &amp; Guides</h1><p>Tips, guides and insights to help you get more out of our free tools.</p></header>
${ catNav }
<div class="blog-grid">${ posts.length ? posts.map( postCard ).join( '' ) : '<p class="gmt-notice">No articles yet — check back soon.</p>' }</div>
</div></main>`
		+ FOOTER + `\n</body></html>`;
}

function blogPostPage( p, posts, blogCategories ) {
	const related = relatedPosts( p, posts );
	const blogCat = blogCategories.find( ( c ) => c.slug === p.categorySlug );
	const tools = relatedToolsForPost( p, blogCat );
	const authorSchema = p.author
		? { '@type': 'Person', name: p.author.name, url: SITE.url + authorUrl( p.author.slug ) }
		: { '@type': 'Organization', name: SITE.name, url: SITE.url + '/' };

	const canonPath = postUrl( p.slug );
	const pageUrl = resolveCanonical( canonPath, p.canonicalUrl );

	const graph = [
		{ '@type': 'BreadcrumbList', itemListElement: [
			{ '@type': 'ListItem', position: 1, name: 'Home', item: SITE.url + '/' },
			{ '@type': 'ListItem', position: 2, name: 'Blog', item: SITE.url + '/blog/' },
			{ '@type': 'ListItem', position: 3, name: p.categoryName, item: SITE.url + blogCatUrl( p.categorySlug ) },
			{ '@type': 'ListItem', position: 4, name: p.title, item: pageUrl }
		] },
		{ '@type': 'Article', headline: p.title, description: p.seoDescription, image: p.cover || undefined,
		  datePublished: p.iso, dateModified: p.updatedIso, mainEntityOfPage: pageUrl,
		  author: authorSchema,
		  publisher: { '@type': 'Organization', name: SITE.name, url: SITE.url + '/' },
		  articleSection: p.categoryName,
		  ...( p.focusKeyword ? { keywords: p.focusKeyword } : {} ) }
	];

	const jsonld = mergeSchemaGraph( graph, p.schemaExtra );

	const hero = p.cover ? `<div class="article__hero"><img src="${ esc( p.cover ) }" alt="${ esc( p.coverAlt ) }"></div>` : '';
	const byline = p.author
		? `<p class="article__byline">By <a href="${ authorUrl( p.author.slug ) }">${ esc( p.author.name ) }</a>${ p.author.role ? ` · ${ esc( p.author.role ) }` : '' }</p>`
		: '';
	const tagsHtml = ( p.tags && p.tags.length )
		? `<div class="article__tags">${ p.tags.map( ( t ) => `<a href="${ tagUrl( t.slug ) }" class="tag">${ esc( t.name ) }</a>` ).join( '' ) }</div>`
		: '';
	const relatedHtml = related.length
		? `<section class="tool-section"><h2>Related articles</h2><div class="blog-grid">${ related.map( postCard ).join( '' ) }</div></section>`
		: '';
	const toolsHtml = tools.length
		? `<section class="tool-section"><h2>Try these free tools</h2><div class="tools-grid">${ tools.map( toolCard ).join( '' ) }</div></section>`
		: '';

	return head( {
		title: p.seoTitle,
		desc: p.seoDescription,
		canonical: canonPath,
		canonicalUrl: p.canonicalUrl,
		keywords: p.focusKeyword,
		ogTitle: p.ogTitle,
		ogDesc: p.ogDescription,
		ogType: 'article',
		ogImage: p.cover || '',
		jsonld,
	} )
		+ HEADER
		+ `<main><div class="page">
<ol class="crumbs"><li><a href="/">Home</a></li><li><a href="/blog/">Blog</a></li><li><a href="${ blogCatUrl( p.categorySlug ) }">${ esc( p.categoryName ) }</a></li><li><span aria-current="page">${ esc( p.title ) }</span></li></ol>
<header class="tool-head">
<span class="eyebrow"><a href="${ blogCatUrl( p.categorySlug ) }" class="badge ${ p.tint }">${ esc( p.categoryName ) }</a> ${ esc( p.date ) }</span>
<h1 class="tool-head__title">${ esc( p.title ) }</h1>
${ byline }
${ p.excerpt ? `<p class="tool-head__intro">${ esc( p.excerpt ) }</p>` : '' }
${ tagsHtml }
</header>
${ hero }
${ ad( 'below_heading' ) }
<article class="article">${ p.bodyHtml }</article>
${ ad( 'below_result' ) }
${ relatedHtml }
${ toolsHtml }
</div></main>`
		+ FOOTER + `\n</body></html>`;
}

function categoryArchivePage( cat, posts ) {
	const tools = cat.toolCategory
		? TOOLS.filter( ( t ) => t.category === cat.toolCategory && isReady( t ) ).slice( 0, 6 )
		: TOOLS.filter( isReady ).slice( 0, 6 );
	const catPosts = posts.filter( ( p ) => p.categorySlug === cat.slug );
	const graph = [
		{ '@type': 'BreadcrumbList', itemListElement: [
			{ '@type': 'ListItem', position: 1, name: 'Home', item: SITE.url + '/' },
			{ '@type': 'ListItem', position: 2, name: 'Blog', item: SITE.url + '/blog/' },
			{ '@type': 'ListItem', position: 3, name: cat.name, item: SITE.url + blogCatUrl( cat.slug ) }
		] },
		{ '@type': 'CollectionPage', name: cat.title, description: cat.desc, url: SITE.url + blogCatUrl( cat.slug ) }
	];
	return head( { title: cat.title, desc: cat.desc, canonical: blogCatUrl( cat.slug ), jsonld: { '@context': 'https://schema.org', '@graph': graph } } )
		+ HEADER
		+ `<main><div class="page page--wide">
<ol class="crumbs"><li><a href="/">Home</a></li><li><a href="/blog/">Blog</a></li><li><span aria-current="page">${ esc( cat.name ) }</span></li></ol>
<header class="page-head"><span class="eyebrow">Category</span><h1>${ esc( cat.name ) }</h1><p>${ esc( cat.blurb || cat.desc ) }</p></header>
<div class="blog-grid">${ catPosts.length ? catPosts.map( postCard ).join( '' ) : '<p class="gmt-notice">Articles in this category are coming soon.</p>' }</div>
${ tools.length ? `<section class="tool-section"><h2>Free ${ esc( cat.name ) } Tools</h2><div class="tools-grid">${ tools.map( toolCard ).join( '' ) }</div></section>` : '' }
</div></main>`
		+ FOOTER + `\n</body></html>`;
}

function authorArchivePage( author, posts ) {
	const authorPosts = posts.filter( ( p ) => p.author?.slug === author.slug );
	const graph = [
		{ '@type': 'BreadcrumbList', itemListElement: [
			{ '@type': 'ListItem', position: 1, name: 'Home', item: SITE.url + '/' },
			{ '@type': 'ListItem', position: 2, name: 'Blog', item: SITE.url + '/blog/' },
			{ '@type': 'ListItem', position: 3, name: author.name, item: SITE.url + authorUrl( author.slug ) }
		] },
		{ '@type': 'ProfilePage', name: author.seoTitle, description: author.seoDescription, url: SITE.url + authorUrl( author.slug ) }
	];
	const avatar = author.avatar ? `<img class="author__avatar" src="${ esc( author.avatar ) }" alt="${ esc( author.name ) }" loading="lazy">` : '';
	return head( { title: author.seoTitle, desc: author.seoDescription, canonical: authorUrl( author.slug ), jsonld: { '@context': 'https://schema.org', '@graph': graph } } )
		+ HEADER
		+ `<main><div class="page page--wide">
<ol class="crumbs"><li><a href="/">Home</a></li><li><a href="/blog/">Blog</a></li><li><span aria-current="page">${ esc( author.name ) }</span></li></ol>
<header class="page-head author-head">${ avatar }<div><span class="eyebrow">Author</span><h1>${ esc( author.name ) }</h1>${ author.role ? `<p>${ esc( author.role ) }</p>` : '' }${ author.bio ? `<p>${ esc( author.bio ) }</p>` : '' }</div></header>
<div class="blog-grid">${ authorPosts.length ? authorPosts.map( postCard ).join( '' ) : '<p class="gmt-notice">No published articles yet.</p>' }</div>
</div></main>`
		+ FOOTER + `\n</body></html>`;
}

function tagArchivePage( tag, posts ) {
	const tagged = posts.filter( ( p ) => ( p.tags || [] ).some( ( t ) => t.slug === tag.slug ) );
	const graph = [
		{ '@type': 'BreadcrumbList', itemListElement: [
			{ '@type': 'ListItem', position: 1, name: 'Home', item: SITE.url + '/' },
			{ '@type': 'ListItem', position: 2, name: 'Blog', item: SITE.url + '/blog/' },
			{ '@type': 'ListItem', position: 3, name: tag.name, item: SITE.url + tagUrl( tag.slug ) }
		] },
		{ '@type': 'CollectionPage', name: tag.title, description: tag.desc, url: SITE.url + tagUrl( tag.slug ) }
	];
	return head( { title: tag.title || `${ tag.name } — Articles | ${ SITE.name }`, desc: tag.desc, canonical: tagUrl( tag.slug ), jsonld: { '@context': 'https://schema.org', '@graph': graph } } )
		+ HEADER
		+ `<main><div class="page page--wide">
<ol class="crumbs"><li><a href="/">Home</a></li><li><a href="/blog/">Blog</a></li><li><span aria-current="page">${ esc( tag.name ) }</span></li></ol>
<header class="page-head"><span class="eyebrow">Tag</span><h1>${ esc( tag.name ) }</h1><p>Articles tagged &ldquo;${ esc( tag.name ) }&rdquo;.</p></header>
<div class="blog-grid">${ tagged.length ? tagged.map( postCard ).join( '' ) : '<p class="gmt-notice">No articles with this tag yet.</p>' }</div>
</div></main>`
		+ FOOTER + `\n</body></html>`;
}

function searchPage() {
	return head( { title: `Search — Tools & Articles | ${ SITE.name }`, desc: `Search free online tools, calculators and blog articles on ${ SITE.name }.`, canonical: '/search/' } )
		+ HEADER
		+ `<main><div class="page page--wide">
<ol class="crumbs"><li><a href="/">Home</a></li><li><span aria-current="page">Search</span></li></ol>
<header class="page-head"><span class="eyebrow">Site search</span><h1>Search Tools &amp; Articles</h1><p>Find calculators, converters and blog posts in one place.</p></header>
<div class="tool-search site-search">
<input type="search" data-site-search="input" placeholder="Search tools, articles, categories…" aria-label="Search site" autocomplete="off">
<ul class="site-search__list" data-site-search="results" role="listbox"></ul>
</div>
<p class="site-search__meta" data-site-search="meta"></p>
</div></main>`
		+ FOOTER + `<script src="/assets/js/site-index.js?v=${ ASSET_VER }"></script>\n<script src="/assets/js/site-search.js?v=${ ASSET_VER }"></script>\n</body></html>`;
}

function buildSiteIndex( posts, blogCategories ) {
	const items = TOOLS.filter( isReady ).map( ( t ) => ( {
		type: 'tool',
		name: t.name,
		excerpt: ( t.meta || '' ).slice( 0, 140 ),
		category: CATEGORIES[ t.category ].name,
		url: toolUrl( t.slug ),
		icon: t.icon,
	} ) );
	for ( const p of posts ) {
		items.push( {
			type: 'article',
			name: p.title,
			excerpt: ( p.excerpt || p.seoDescription || '' ).slice( 0, 140 ),
			category: p.categoryName,
			url: postUrl( p.slug ),
			icon: 'article',
		} );
	}
	for ( const c of blogCategories ) {
		items.push( {
			type: 'category',
			name: c.name,
			excerpt: ( c.blurb || c.desc || '' ).slice( 0, 140 ),
			category: 'Blog category',
			url: blogCatUrl( c.slug ),
			icon: 'folder',
		} );
	}
	return items;
}

/* Inject homepage sections from Contentful (markers in index.html). */
function replaceMarker( html, start, end, content ) {
	const a = html.indexOf( start ), b = html.indexOf( end );
	if ( a === -1 || b === -1 ) return html;
	return html.slice( 0, a + start.length ) + '\n' + content + '\n\t\t\t' + html.slice( b );
}

function featuredPostHtml( p ) {
	if ( ! p ) return '<p class="gmt-notice">Featured stories coming soon — subscribe below for updates.</p>';
	const media = p.cover
		? `<div class="featured-post__media"><img src="${ esc( p.cover ) }" alt="${ esc( p.coverAlt ) }" loading="lazy"></div>`
		: '';
	return `<article class="featured-post">
${ media }
<div class="featured-post__body">
<div class="post__meta"><a href="${ blogCatUrl( p.categorySlug ) }" class="badge ${ p.tint }">${ esc( p.categoryName ) }</a><span class="post__date">${ esc( p.date ) }</span></div>
<h3><a href="${ postUrl( p.slug ) }">${ esc( p.title ) }</a></h3>
<p>${ esc( p.excerpt ) }</p>
<a href="${ postUrl( p.slug ) }" class="btn btn--primary">Read Featured Story <span class="material-symbols-outlined">arrow_forward</span></a>
</div>
</article>`;
}

function trendingHtml( posts ) {
	if ( ! posts.length ) return '<p class="gmt-notice">Trending guides will appear here as we publish new articles.</p>';
	return `<ol class="trending-list">${ posts.map( ( p ) => `
<li><a href="${ postUrl( p.slug ) }"><span class="trending-list__cat">${ esc( p.categoryName ) }</span><span class="trending-list__title">${ esc( p.title ) }</span><span class="trending-list__date">${ esc( p.date ) }</span></a></li>` ).join( '' ) }</ol>`;
}

function guidesHtml( categories ) {
	return `<div class="guides-grid">${ categories.map( ( c ) => `
<a class="guide-card" href="${ blogCatUrl( c.slug ) }">
<h3>${ esc( c.name ) }</h3>
<p>${ esc( ( c.blurb || '' ).slice( 0, 90 ) ) }</p>
<span class="guide-card__link">Browse guides <span class="material-symbols-outlined">arrow_forward</span></span>
</a>` ).join( '' ) }</div>`;
}

async function patchHomepage( posts, blogCategories ) {
	const file = join( ROOT, 'index.html' );
	let html;
	try { html = await readFile( file, 'utf8' ); } catch { return; }
	const featured = posts.find( ( p ) => p.featured ) || posts[ 0 ];
	const next = replaceMarker( replaceMarker( replaceMarker( replaceMarker( html,
		'<!-- FEATURED:START -->', '<!-- FEATURED:END -->', featuredPostHtml( featured ) ),
		'<!-- TRENDING:START -->', '<!-- TRENDING:END -->', trendingHtml( posts.slice( 0, 5 ) ) ),
		'<!-- BLOG:START -->', '<!-- BLOG:END -->', posts.length ? posts.slice( 0, 4 ).map( postCard ).join( '\n' ) : '<p class="gmt-notice">New articles coming soon.</p>' ),
		'<!-- GUIDES:START -->', '<!-- GUIDES:END -->', guidesHtml( blogCategories.slice( 0, 6 ) ) );
	let patched = HEAD_EXTRAS && ! next.includes( 'googletagmanager' )
		? next.replace( '<!-- BUILD:HEAD -->', HEAD_EXTRAS + '\n<!-- BUILD:HEAD -->' )
		: next;
	if ( patched !== html ) {
		await writeFile( file, patched, 'utf8' );
		console.log( '✓ Homepage magazine sections updated.' );
	}
}

const escXml = ( s = '' ) => String( s ).replace( /&/g, '&amp;' ).replace( /</g, '&lt;' ).replace( />/g, '&gt;' ).replace( /"/g, '&quot;' );
const cdata = ( s = '' ) => `<![CDATA[${ String( s ).replace( /]]>/g, ']]]]><![CDATA[>' ) }]]>`;

function rssFeed( posts ) {
	const items = posts.map( ( p ) => `  <item>
    <title>${ escXml( p.title ) }</title>
    <link>${ SITE.url }${ postUrl( p.slug ) }</link>
    <guid isPermaLink="true">${ SITE.url }${ postUrl( p.slug ) }</guid>
    <pubDate>${ new Date( p.iso ).toUTCString() }</pubDate>
    <description>${ cdata( p.excerpt || p.seoDescription ) }</description>
  </item>` ).join( '\n' );
	return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${ escXml( SITE.name ) }</title>
  <link>${ SITE.url }/</link>
  <description>Free online tools, calculators and how-to guides from ${ SITE.name }.</description>
  <language>en-us</language>
  <atom:link href="${ SITE.url }/feed.xml" rel="self" type="application/rss+xml"/>
${ items || '  <!-- no posts yet -->' }
</channel>
</rss>
`;
}

function notFoundPage() {
	return head( { title: `Page Not Found — ${ SITE.name }`, desc: 'The page you requested could not be found. Browse our free tools and articles.', canonical: '/404/' } ).replace( '</head>', '<meta name="robots" content="noindex,follow">\n</head>' )
		+ HEADER
		+ `<main><div class="page page--wide">
<header class="page-head"><span class="eyebrow">404</span><h1>Page not found</h1><p>Sorry, we could not find that page. Try searching or explore our free tools and guides.</p></header>
${ searchBox.replace( 'Search tools…', 'Search tools, articles…' ) }
<div class="tools-grid" style="margin-top:24px">${ TOOLS.filter( isReady ).slice( 0, 6 ).map( toolCard ).join( '' ) }</div>
<p style="margin-top:28px"><a href="/">← Back to home</a> · <a href="/blog/">Blog</a> · <a href="/tools/">All tools</a></p>
</div></main>`
		+ FOOTER + `<script src="/assets/js/tool-runtime.js?v=${ ASSET_VER }"></script>\n<script src="/assets/js/tools-index.js?v=${ ASSET_VER }"></script>\n<script src="/assets/js/site-index.js?v=${ ASSET_VER }"></script>\n</body></html>`;
}

/* -------------------------------- sitemap -------------------------------- */
function sitemap( posts, blogCategories, authors, tags ) {
	const urls = [ '/', '/tools/', '/search/' ]
		.concat( STATIC_PAGES.map( ( p ) => staticUrl( p.slug ) ) )
		.concat( Object.keys( CATEGORIES ).map( catUrl ) )
		.concat( TOOLS.filter( isReady ).map( ( t ) => toolUrl( t.slug ) ) )
		.concat( blogCategories.map( ( c ) => blogCatUrl( c.slug ) ) )
		.concat( authors.map( ( a ) => authorUrl( a.slug ) ) )
		.concat( tags.map( ( t ) => tagUrl( t.slug ) ) )
		.concat( [ '/blog/' ] )
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
	await loadEnv();
	HEAD_EXTRAS = analyticsHead( esc );

	let n = 0;
	for ( const t of TOOLS ) { await out( join( t.slug, 'index.html' ), toolPage( t ) ); n++; }
	await out( join( 'tools', 'index.html' ), listingPage() );
	for ( const [ key, cat ] of Object.entries( CATEGORIES ) ) { await out( join( 'tools', key, 'index.html' ), categoryPage( key, cat ) ); }

	/* ------------------------------- blog -------------------------------- */
	const { posts, authors: cfAuthors, categories: cfCategories, tags: cfTags } = await fetchBlogData();
	const blogCategories = mergeBlogCategories( posts, cfCategories );
	const authors = mergeAuthors( posts, cfAuthors );
	const tags = mergeTags( posts, cfTags );

	if ( posts.length ) {
		for ( const p of posts ) { await out( join( 'blog', p.slug, 'index.html' ), blogPostPage( p, posts, blogCategories ) ); }
	}
	await out( join( 'blog', 'index.html' ), blogListingPage( posts, blogCategories ) );
	await patchHomepage( posts, blogCategories );
	await out( 'feed.xml', rssFeed( posts ) );
	await out( '404.html', notFoundPage() );

	for ( const cat of blogCategories ) {
		await out( join( 'category', cat.slug, 'index.html' ), categoryArchivePage( cat, posts ) );
	}
	for ( const author of authors ) {
		await out( join( 'author', author.slug, 'index.html' ), authorArchivePage( author, posts ) );
	}
	for ( const tag of tags ) {
		await out( join( 'tag', tag.slug, 'index.html' ), tagArchivePage( tag, posts ) );
	}
	await out( join( 'search', 'index.html' ), searchPage() );

	for ( const p of STATIC_PAGES ) { await out( join( p.slug, 'index.html' ), staticPage( p ) ); }
	await out( 'robots.txt', robotsTxt() );
	await out( 'sitemap.xml', sitemap( posts, blogCategories, authors, tags ) );

	const index = TOOLS.map( ( t ) => ( { slug: t.slug, name: t.name, category: CATEGORIES[ t.category ].name, icon: t.icon, url: toolUrl( t.slug ) } ) );
	await out( join( 'assets', 'js', 'tools-index.js' ), 'window.GMT_TOOLS = ' + JSON.stringify( index ) + ';\n' );
	await out( join( 'assets', 'js', 'site-index.js' ), 'window.GMT_SITE_INDEX = ' + JSON.stringify( buildSiteIndex( posts, blogCategories ) ) + ';\n' );

	console.log( `✓ Generated ${ n } tool pages, ${ Object.keys( CATEGORIES ).length } tool categories, ${ STATIC_PAGES.length } static pages.` );
	console.log( `✓ Blog archives: ${ blogCategories.length } categories, ${ authors.length } authors, ${ tags.length } tags, search + RSS + 404.` );
	console.log( `✓ Live calculators: ${ TOOLS.filter( isReady ).length } / ${ TOOLS.length }` );
	console.log( `✓ Blog posts: ${ posts.length ? posts.length + ' from Contentful' : 'none (static placeholder kept)' }` );
}
build().catch( ( e ) => { console.error( e ); process.exit( 1 ); } );
