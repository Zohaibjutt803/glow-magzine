/* Glow Magzine — site-wide chrome (header nav, newsletter). */
( function () {
	'use strict';

	var header = document.getElementById( 'header' );
	function onScroll() {
		if ( header ) { header.classList.toggle( 'is-stuck', window.scrollY > 8 ); }
	}
	window.addEventListener( 'scroll', onScroll, { passive: true } );
	onScroll();

	var toggle = document.getElementById( 'navToggle' );
	var menu = document.getElementById( 'mobileMenu' );
	if ( toggle && menu && ! toggle.dataset.navBound ) {
		toggle.dataset.navBound = '1';

		function setOpen( open ) {
			menu.classList.toggle( 'is-open', open );
			document.body.classList.toggle( 'nav-open', open );
			toggle.setAttribute( 'aria-expanded', open ? 'true' : 'false' );
			toggle.setAttribute( 'aria-label', open ? 'Close menu' : 'Open menu' );
			var icon = toggle.querySelector( '.material-symbols-outlined' );
			if ( icon ) { icon.textContent = open ? 'close' : 'menu'; }
		}

		toggle.addEventListener( 'click', function ( e ) {
			e.preventDefault();
			e.stopPropagation();
			setOpen( ! menu.classList.contains( 'is-open' ) );
		} );

		menu.addEventListener( 'click', function ( e ) {
			if ( e.target.closest( 'a' ) ) { setOpen( false ); }
		} );

		document.addEventListener( 'click', function ( e ) {
			if ( ! menu.classList.contains( 'is-open' ) ) { return; }
			if ( e.target.closest( '#mobileMenu' ) || e.target.closest( '#navToggle' ) ) { return; }
			setOpen( false );
		} );

		document.addEventListener( 'keydown', function ( e ) {
			if ( e.key === 'Escape' ) { setOpen( false ); }
		} );
	}

	var form = document.getElementById( 'newsletterForm' );
	if ( form && ! form.dataset.bound ) {
		form.dataset.bound = '1';
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
