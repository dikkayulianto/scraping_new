<?php
/**
 * The template for displaying all pages
 *
 * @package ScrapeFlow_Theme
 */

get_header();
?>

<main id="primary" class="site-main container" style="padding: 40px 0 80px;">
	<?php
	while ( have_posts() ) :
		the_post();
		?>
		<article id="post-<?php the_ID(); ?>" <?php post_class(); ?>>
			<header class="post-header" style="padding: 30px 0 20px;">
				<h1 class="post-title" style="font-size: 2.2rem;"><?php the_title(); ?></h1>
			</header>

			<div class="post-content-body">
				<?php
				the_content();

				wp_link_pages(
					array(
						'before' => '<div class="page-links">' . esc_html__( 'Pages:', 'scrapeflow-theme' ),
						'after'  => '</div>',
					)
				);
				?>
			</div>
		</article>
		<?php
	endwhile;
	?>
</main>

<?php
get_footer();
