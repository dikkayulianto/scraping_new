<?php
/**
 * The template for displaying all single posts
 *
 * @package ScrapeFlow_Theme
 */

get_header();
?>

<main id="primary" class="site-main container" style="padding-bottom: 80px;">
	<?php
	while ( have_posts() ) :
		the_post();
		?>
		<article id="post-<?php the_ID(); ?>" <?php post_class(); ?>>
			<header class="post-header">
				<?php
				$categories = get_the_category();
				if ( ! empty( $categories ) ) {
					echo '<span class="post-category">' . esc_html( $categories[0]->name ) . '</span>';
				}
				?>
				<h1 class="post-title"><?php the_title(); ?></h1>
				<div class="post-meta">
					<span>Dipublikasikan pada <strong><?php echo get_the_date(); ?></strong></span>
					&bull;
					<span>Oleh <strong><?php the_author(); ?></strong></span>
				</div>
			</header>

			<?php if ( has_post_thumbnail() ) : ?>
				<div class="post-featured-image">
					<?php the_post_thumbnail( 'full' ); ?>
				</div>
			<?php endif; ?>

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
