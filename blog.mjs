/**
 * GlowMagazine — Contentful blog source.
 * Fetches blogPost, author, category and tag entries from the Content Delivery API.
 *
 * Expected Contentful content types (create in Contentful → Content model):
 *   blogPost   slug, title, excerpt, body, coverImage, publishedDate, updatedDate,
 *              seoTitle, seoDescription, author (ref→author), category (ref→category or Short text),
 *              tags (ref→tag, many), relatedTools (Short text list of tool slugs), featured (Boolean)
 *   author     slug, name, bio, avatar, role, seoTitle, seoDescription
 *   category   slug, name, description, seoTitle, seoDescription
 *   tag        slug, name, seoTitle, seoDescription
 *
 * Graceful fallback: missing env or API errors → empty data; static blog placeholders kept.
 */
import { BLOG_CATEGORIES, CATEGORY_ALIASES } from './blog-categories.mjs';
import { loadEnv } from './env.mjs';

const PILLAR_BY_SLUG = new Map( BLOG_CATEGORIES.map( ( c ) => [ c.slug, c ] ) );

export function slugify( s = '' ) {
	return String( s ).trim().toLowerCase()
		.replace( /[^a-z0-9]+/g, '-' )
		.replace( /^-|-$/g, '' ) || 'uncategorized';
}

function resolveCategorySlug( raw ) {
	const slug = slugify( raw );
	return CATEGORY_ALIASES[ slug ] || slug;
}

/* --------------------------- env (shared) --------------------------- */

const esc = ( s = '' ) => String( s ).replace( /&/g, '&amp;' ).replace( /</g, '&lt;' ).replace( />/g, '&gt;' ).replace( /"/g, '&quot;' );

/* --------------------- Contentful rich-text -> HTML --------------------- */
const MARK = { bold: [ '<strong>', '</strong>' ], italic: [ '<em>', '</em>' ], underline: [ '<u>', '</u>' ], code: [ '<code>', '</code>' ] };

function renderText( node ) {
	let html = esc( node.value || '' ).replace( /\n/g, '<br>' );
	for ( const m of node.marks || [] ) {
		const tag = MARK[ m.type ];
		if ( tag ) html = tag[ 0 ] + html + tag[ 1 ];
	}
	return html;
}

function renderNodes( nodes, assets ) {
	return ( nodes || [] ).map( ( n ) => renderNode( n, assets ) ).join( '' );
}

function renderNode( node, assets ) {
	switch ( node.nodeType ) {
		case 'text': return renderText( node );
		case 'paragraph': return `<p>${ renderNodes( node.content, assets ) }</p>`;
		case 'heading-1': return `<h2>${ renderNodes( node.content, assets ) }</h2>`;
		case 'heading-2': return `<h2>${ renderNodes( node.content, assets ) }</h2>`;
		case 'heading-3': return `<h3>${ renderNodes( node.content, assets ) }</h3>`;
		case 'heading-4': return `<h4>${ renderNodes( node.content, assets ) }</h4>`;
		case 'heading-5': return `<h5>${ renderNodes( node.content, assets ) }</h5>`;
		case 'heading-6': return `<h6>${ renderNodes( node.content, assets ) }</h6>`;
		case 'unordered-list': return `<ul>${ renderNodes( node.content, assets ) }</ul>`;
		case 'ordered-list': return `<ol>${ renderNodes( node.content, assets ) }</ol>`;
		case 'list-item': return `<li>${ renderNodes( node.content, assets ) }</li>`;
		case 'blockquote': return `<blockquote>${ renderNodes( node.content, assets ) }</blockquote>`;
		case 'hr': return '<hr>';
		case 'hyperlink': {
			const uri = esc( node.data?.uri || '#' );
			const ext = /^https?:\/\//.test( uri ) ? ' target="_blank" rel="noopener nofollow"' : '';
			return `<a href="${ uri }"${ ext }>${ renderNodes( node.content, assets ) }</a>`;
		}
		case 'embedded-asset-block': {
			const a = assets.get( node.data?.target?.sys?.id );
			if ( ! a || ! a.url ) return '';
			return `<figure class="article__figure"><img src="${ esc( a.url ) }" alt="${ esc( a.title ) }" loading="lazy">${ a.title ? `<figcaption>${ esc( a.title ) }</figcaption>` : '' }</figure>`;
		}
		default:
			return node.content ? renderNodes( node.content, assets ) : '';
	}
}

function assetMap( includes ) {
	const map = new Map();
	for ( const a of includes?.Asset || [] ) {
		const file = a.fields?.file;
		if ( ! file?.url ) continue;
		map.set( a.sys.id, { url: 'https:' + file.url, title: a.fields?.title || a.fields?.description || '' } );
	}
	return map;
}

function entryMap( items ) {
	const map = new Map();
	for ( const it of items || [] ) map.set( it.sys.id, it );
	return map;
}

function fmtDate( iso ) {
	const d = new Date( iso );
	if ( isNaN( d ) ) return '';
	return d.toLocaleDateString( 'en-US', { year: 'numeric', month: 'long', day: 'numeric' } );
}

const BADGE_TINTS = [ 't-indigo', 't-purple', 't-pink', 't-blue', 't-violet' ];
const tintFor = ( s = '' ) => BADGE_TINTS[ Array.from( s ).reduce( ( a, c ) => a + c.charCodeAt( 0 ), 0 ) % BADGE_TINTS.length ];

function normaliseAuthor( item, assets ) {
	const f = item?.fields || {};
	const avatar = f.avatar?.sys?.id ? assets.get( f.avatar.sys.id ) : null;
	return {
		slug: f.slug || slugify( f.name ),
		name: f.name || 'Glow Magzine',
		bio: f.bio || '',
		role: f.role || '',
		avatar: avatar?.url || '',
		seoTitle: f.seoTitle || `${ f.name } — Author | Glow Magzine`,
		seoDescription: f.seoDescription || f.bio || `Articles by ${ f.name } on Glow Magzine.`,
	};
}

function normaliseCategory( item ) {
	const f = item?.fields || {};
	const slug = f.slug || slugify( f.name );
	const pillar = PILLAR_BY_SLUG.get( slug );
	return {
		slug,
		name: f.name || pillar?.name || slug,
		title: f.seoTitle || pillar?.title || `${ f.name } Articles | Glow Magzine`,
		desc: f.seoDescription || f.description || pillar?.desc || `Articles in ${ f.name }.`,
		blurb: f.description || pillar?.blurb || '',
		toolCategory: pillar?.toolCategory || '',
	};
}

function normaliseTag( item ) {
	const f = item?.fields || {};
	return {
		slug: f.slug || slugify( f.name ),
		name: f.name || 'Tag',
		title: f.seoTitle || `${ f.name } — Articles | Glow Magzine`,
		desc: f.seoDescription || `Articles tagged ${ f.name } on Glow Magzine.`,
	};
}

function resolveRef( field, entries ) {
	const id = field?.sys?.id;
	return id ? entries.get( id ) : null;
}

function normalisePost( item, assets, entries ) {
	const f = item.fields || {};
	const cover = f.coverImage?.sys?.id ? assets.get( f.coverImage.sys.id ) : null;
	const iso = f.publishedDate || item.sys?.createdAt;
	const updatedIso = f.updatedDate || iso;

	let categoryName = '';
	let categorySlug = 'uncategorized';
	const catRef = resolveRef( f.category, entries );
	if ( catRef ) {
		const cat = normaliseCategory( catRef );
		categoryName = cat.name;
		categorySlug = cat.slug;
	} else if ( typeof f.category === 'string' && f.category ) {
		categoryName = f.category;
		categorySlug = resolveCategorySlug( f.category );
	}

	const authorRef = resolveRef( f.author, entries );
	const author = authorRef ? normaliseAuthor( authorRef, assets ) : null;

	const tags = [];
	for ( const t of f.tags || [] ) {
		const ref = resolveRef( t, entries );
		if ( ref ) tags.push( normaliseTag( ref ) );
		else if ( typeof t === 'string' && t ) tags.push( { slug: slugify( t ), name: t, title: '', desc: '' } );
	}

	const relatedTools = ( f.relatedTools || [] ).filter( Boolean ).map( ( s ) => String( s ).trim() );

	return {
		slug: f.slug,
		title: f.title || 'Untitled',
		categoryName,
		categorySlug,
		excerpt: f.excerpt || '',
		cover: cover?.url || '',
		coverAlt: cover?.title || f.title || '',
		bodyHtml: f.body ? renderNodes( f.body.content, assets ) : '',
		iso,
		updatedIso,
		date: fmtDate( iso ),
		tint: tintFor( categoryName ),
		seoTitle: f.seoTitle || f.title,
		seoDescription: f.seoDescription || f.excerpt || '',
		author,
		tags,
		relatedTools,
		featured: !! f.featured,
	};
}

async function cdaFetch( space, token, envId, params ) {
	const qs = new URLSearchParams( params );
	const url = `https://cdn.contentful.com/spaces/${ space }/environments/${ envId }/entries?${ qs }`;
	const res = await fetch( url, { headers: { Authorization: `Bearer ${ token }` } } );
	if ( ! res.ok ) return null;
	return res.json();
}

async function fetchType( space, token, envId, contentType, order ) {
	const data = await cdaFetch( space, token, envId, {
		content_type: contentType,
		limit: '200',
		include: '2',
		...( order ? { order } : {} ),
	} );
	if ( ! data ) return { items: [], includes: {} };
	return data;
}

/** @deprecated Use fetchBlogData() */
export async function fetchPosts() {
	const { posts } = await fetchBlogData();
	return posts;
}

export async function fetchBlogData() {
	await loadEnv();
	const space = process.env.CONTENTFUL_SPACE_ID;
	const token = process.env.CONTENTFUL_CDA_TOKEN;
	const envId = process.env.CONTENTFUL_ENVIRONMENT || 'master';

	if ( ! space || ! token ) {
		console.warn( '⚠ Contentful env not set (CONTENTFUL_SPACE_ID / CONTENTFUL_CDA_TOKEN) — keeping static blog.' );
		return { posts: [], authors: [], categories: [], tags: [] };
	}

	try {
		const [ postData, authorData, categoryData, tagData ] = await Promise.all( [
			fetchType( space, token, envId, 'blogPost', '-fields.publishedDate' ),
			fetchType( space, token, envId, 'author', 'fields.name' ),
			fetchType( space, token, envId, 'category', 'fields.name' ),
			fetchType( space, token, envId, 'tag', 'fields.name' ),
		] );

		const postAssets = assetMap( postData.includes );
		const authorAssets = assetMap( authorData.includes );
		const allAssets = new Map( [ ...postAssets, ...authorAssets ] );
		const postEntries = entryMap( [
			...( postData.items || [] ),
			...( postData.includes?.Entry || [] ),
			...( authorData.items || [] ),
			...( categoryData.items || [] ),
			...( tagData.items || [] ),
		] );

		const posts = ( postData.items || [] )
			.map( ( it ) => normalisePost( it, allAssets, postEntries ) )
			.filter( ( p ) => p.slug );

		const authors = ( authorData.items || [] ).map( ( it ) => normaliseAuthor( it, allAssets ) ).filter( ( a ) => a.slug );
		const categories = ( categoryData.items || [] ).map( normaliseCategory ).filter( ( c ) => c.slug );
		const tags = ( tagData.items || [] ).map( normaliseTag ).filter( ( t ) => t.slug );

		console.log( `✓ Contentful: ${ posts.length } post(s), ${ authors.length } author(s), ${ categories.length } category(ies), ${ tags.length } tag(s).` );
		return { posts, authors, categories, tags };
	} catch ( e ) {
		console.warn( `⚠ Contentful fetch failed (${ e.message }) — keeping static blog.` );
		return { posts: [], authors: [], categories: [], tags: [] };
	}
}
