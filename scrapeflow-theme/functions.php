<?php
/**
 * ScrapeFlow Minimalist Blog functions and definitions
 *
 * @link https://developer.wordpress.org/themes/basics/theme-functions/
 *
 * @package ScrapeFlow_Theme
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

if ( ! function_exists( 'scrapeflow_theme_setup' ) ) :
	/**
	 * Sets up theme defaults and registers support for various WordPress features.
	 */
	function scrapeflow_theme_setup() {
		// Add default posts and comments RSS feed links to head.
		add_theme_support( 'automatic-feed-links' );

		/*
		 * Let WordPress manage the document title.
		 * By adding theme support, we declare that this theme does not use a
		 * hard-coded <title> tag in the document head, and WordPress will
		 * provide it for us.
		 */
		add_theme_support( 'title-tag' );

		/*
		 * Enable support for Post Thumbnails on posts and pages.
		 *
		 * @link https://developer.wordpress.org/themes/functionality/featured-images-post-thumbnails/
		 */
		add_theme_support( 'post-thumbnails' );

		// Register Main Menu
		register_nav_menus(
			array(
				'menu-1' => esc_html__( 'Primary Menu', 'scrapeflow-theme' ),
			)
		);

		/*
		 * Switch default core markup for search form, comment form, and comments
		 * to output valid HTML5.
		 */
		add_theme_support(
			'html5',
			array(
				'search-form',
				'comment-form',
				'comment-list',
				'gallery',
				'caption',
				'style',
				'script',
			)
		);

		// Add support for responsive embeds
		add_theme_support( 'responsive-embeds' );

		// Add support for Gutenberg block styles
		add_theme_support( 'wp-block-styles' );
	}
endif;
add_action( 'after_setup_theme', 'scrapeflow_theme_setup' );

/**
 * Enqueue scripts and styles.
 */
function scrapeflow_theme_scripts() {
	// Enqueue Google Fonts (Inter & Space Grotesk)
	wp_enqueue_style( 'scrapeflow-theme-fonts', 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@600;700&display=swap', array(), null );

	// Enqueue Lucide Icons for client-side modern icons
	wp_enqueue_script( 'lucide-icons', 'https://unpkg.com/lucide@latest', array(), null, true );

	// Enqueue Theme Stylesheet
	wp_enqueue_style( 'scrapeflow-theme-style', get_stylesheet_uri(), array(), '1.0.0' );

	// Enqueue Custom Navigation and Dark/Light switcher script
	wp_add_inline_script( 'lucide-icons', '
		document.addEventListener("DOMContentLoaded", function() {
			// Initialize Lucide Icons
			if (typeof lucide !== "undefined") {
				lucide.createIcons();
			}

			// Dark/Light Mode Switcher
			const body = document.body;
			const toggleBtn = document.getElementById("theme-toggle");
			
			// Load preference
			const savedMode = localStorage.getItem("scrapeflow-wp-mode") || "dark";
			if (savedMode === "dark") {
				body.classList.add("dark-mode");
				body.classList.remove("light-mode");
			} else {
				body.classList.add("light-mode");
				body.classList.remove("dark-mode");
			}
			updateToggleIcon(savedMode);

			if (toggleBtn) {
				toggleBtn.addEventListener("click", function() {
					if (body.classList.contains("dark-mode")) {
						body.classList.remove("dark-mode");
						body.classList.add("light-mode");
						localStorage.setItem("scrapeflow-wp-mode", "light");
						updateToggleIcon("light");
					} else {
						body.classList.remove("light-mode");
						body.classList.add("dark-mode");
						localStorage.setItem("scrapeflow-wp-mode", "dark");
						updateToggleIcon("dark");
					}
				});
			}

			function updateToggleIcon(mode) {
				const iconContainer = document.querySelector("#theme-toggle");
				if (!iconContainer) return;
				if (mode === "light") {
					iconContainer.innerHTML = \'<i data-lucide="moon" style="width:18px;height:18px;"></i>\';
				} else {
					iconContainer.innerHTML = \'<i data-lucide="sun" style="width:18px;height:18px;"></i>\';
				}
				if (typeof lucide !== "undefined") {
					lucide.createIcons();
				}
			}
		});
	' );
}
add_action( 'wp_enqueue_scripts', 'scrapeflow_theme_scripts' );

/**
 * Filter list post excerpt length
 */
function scrapeflow_theme_excerpt_length( $length ) {
	return 25; // 25 words limit for list cards excerpt
}
add_filter( 'excerpt_length', 'scrapeflow_theme_excerpt_length', 999 );

/**
 * Filter read more text link
 */
function scrapeflow_theme_excerpt_more( $more ) {
	return '...';
}
add_filter( 'excerpt_more', 'scrapeflow_theme_excerpt_more' );
