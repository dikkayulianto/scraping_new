<?php
/**
 * The main template file
 *
 * @package ScrapeFlow_Theme
 */

get_header();
?>

<main id="primary" class="site-main container">
	<?php if ( have_posts() ) : ?>
		<div class="posts-grid">
			<?php
			while ( have_posts() ) :
				the_post();
				?>
				<article id="post-<?php the_ID(); ?>" <?php post_class( 'post-card' ); ?>>
					<?php 
					$thumbnail_url = scrapeflow_get_post_thumbnail_url( get_the_ID() );
					if ( ! empty( $thumbnail_url ) ) : 
					?>
						<a class="post-thumbnail-link" href="<?php the_permalink(); ?>">
							<img src="<?php echo esc_url( $thumbnail_url ); ?>" alt="<?php the_title_attribute(); ?>" loading="lazy" />
						</a>
					<?php endif; ?>

					<div class="post-card-content">
						<div class="post-card-meta">
							<span><?php echo get_the_date(); ?></span>
							<?php
							$categories = get_the_category();
							if ( ! empty( $categories ) ) {
								echo ' &bull; <span>' . esc_html( $categories[0]->name ) . '</span>';
							}
							?>
						</div>

						<h2 class="post-card-title">
							<a href="<?php the_permalink(); ?>" rel="bookmark">
								<?php the_title(); ?>
							</a>
						</h2>

						<div class="post-card-excerpt">
							<?php the_excerpt(); ?>
						</div>

						<a href="<?php the_permalink(); ?>" class="post-card-more">
							Baca Selengkapnya <i data-lucide="arrow-right" style="width:14px;height:14px;display:inline-block;vertical-align:middle;"></i>
						</a>
					</div>
				</article>
				<?php
			endwhile;
			?>
		</div>

		<?php
		the_posts_pagination(
			array(
				'mid_size'  => 2,
				'prev_text' => '<i data-lucide="chevron-left" style="width:16px;height:16px;display:inline-block;vertical-align:middle;"></i>',
				'next_text' => '<i data-lucide="chevron-right" style="width:16px;height:16px;display:inline-block;vertical-align:middle;"></i>',
				'class'     => 'pagination',
			)
		);
		?>

	<?php else : ?>
		<div style="text-align: center; padding: 100px 0;">
			<i data-lucide="folder-open" style="width: 48px; height: 48px; opacity: 0.4; margin-bottom: 16px;"></i>
			<h2>Belum Ada Artikel</h2>
			<p style="color: var(--text-muted);">Mulai posting artikel hasil scrape Anda ke WordPress untuk melihatnya di sini.</p>
		</div>
	<?php endif; ?>
</main>

<?php
get_footer();
