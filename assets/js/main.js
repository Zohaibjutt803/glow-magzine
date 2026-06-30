/* GlowMagazine homepage — interactions (vanilla JS, no dependencies). */
( function () {
	'use strict';

	// Sticky header shadow on scroll.
	var header = document.getElementById( 'header' );
	function onScroll() {
		if ( ! header ) { return; }
		header.classList.toggle( 'is-stuck', window.scrollY > 8 );
	}
	window.addEventListener( 'scroll', onScroll, { passive: true } );
	onScroll();

	// Mobile menu toggle.
	var toggle = document.getElementById( 'navToggle' );
	var menu = document.getElementById( 'mobileMenu' );
	if ( toggle && menu ) {
		toggle.addEventListener( 'click', function () {
			var open = menu.classList.toggle( 'is-open' );
			document.body.classList.toggle( 'nav-open', open );
			toggle.setAttribute( 'aria-expanded', open ? 'true' : 'false' );
			toggle.querySelector( '.material-symbols-outlined' ).textContent = open ? 'close' : 'menu';
		} );
		// Close after tapping a link.
		menu.addEventListener( 'click', function ( e ) {
			if ( e.target.closest( 'a' ) ) {
				menu.classList.remove( 'is-open' );
				document.body.classList.remove( 'nav-open' );
				toggle.setAttribute( 'aria-expanded', 'false' );
				toggle.querySelector( '.material-symbols-outlined' ).textContent = 'menu';
			}
		} );
	}

	// Newsletter (demo handler — wire to a real endpoint later).
	var form = document.getElementById( 'newsletterForm' );
	if ( form ) {
		form.addEventListener( 'submit', function ( e ) {
			e.preventDefault();
			var btn = form.querySelector( 'button' );
			btn.textContent = '✓ Subscribed!';
			btn.disabled = true;
			form.querySelector( 'input' ).value = '';
			setTimeout( function () { btn.textContent = 'Subscribe Now'; btn.disabled = false; }, 2500 );
		} );
	}
} )();
