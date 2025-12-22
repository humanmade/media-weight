<?php
/**
 * Main plugin namespace.
 */

namespace HM_Media_Weight;

/**
 * Connect namespace functions to actions and hooks.
 */
function bootstrap() : void {
	// Track resource sizes in the iframed preview, reporting results to the editor window.
	add_action( 'wp_head', __NAMESPACE__ . '\\output_resource_tracking_on_preview' );

	// Disable analytics script injection to avoid skewing media weight measurements. Run before Altis Analytics hooks in.
	add_action( 'plugins_loaded', __NAMESPACE__ . '\disable_analytics_script_injection', 11 );

	// Disable lazy loading for iframes in media weight preview.
	add_filter( 'wp_lazy_loading_enabled', __NAMESPACE__ . '\disable_lazy_loading_for_iframes_in_preview', PHP_INT_MAX );

	// Output some shimmer styles for the media weight loading state to wp-admin footer.
	add_action( 'admin_footer', __NAMESPACE__ . '\\output_shimmer_styles' );

	// Remove autoplay from video blocks in the media weight preview - use the render_block filter.
	add_filter( 'render_block', __NAMESPACE__ . '\\remove_video_autoplay_in_preview', 10, 2 );
}

/**
 * Prints script to the head tag for passing PerformanceEntry
 * objects to the postMessage method when adding an iframe.
 *
 * @return void
 */
function output_resource_tracking_on_preview() {
	// Bail if mediaWeight URL param is not set.
	if ( ! isset( $_GET['mediaWeight'] ) ) {
		return;
	}
?>
<script>
	// Collect all resource information once the page is fully loaded.
	// Ensure lazy loaded elements like videos are also loaded.
	window.addEventListener( 'load', () => {
		// Start at top, then scroll to bottom
		setTimeout( () => {
			window.scrollTo({
				top: 0,
				behavior: 'smooth'
			});
			setTimeout( () => {
				window.scrollTo({
					top: document.body.scrollHeight,
					behavior: 'smooth'
				});
				setTimeout(() => {
				const entries = window.performance.getEntriesByType( 'resource' );
				window.parent.postMessage( JSON.stringify( filterEntriesToContent( entries ) ), window.location.origin );
			}, 2000 );
			}, 500);
		}, 100 );
	} );

	/**
	 * For the purposes of limiting to content the author controls, limit to media
	 * contained in the class="article-main-section" div, excluding byline avatar images
	 * from the "post-single__bylines" div.
	 *
	 * @param {PerformanceEntry[]} entries Array of performance entries.
	 * @return {PerformanceEntry[]} Filtered array of performance entries.
	 */
	function filterEntriesToContent( entries ) {
		const articleMainSection = document.querySelector( '.article-main-section' );
		const avatarBylines      = document.querySelector( '.post-single__bylines' );
		if ( articleMainSection ) {
			entries = entries.filter( ( entry ) => {
				// Look for an image with the srcset containing the entity name.
				const element  = document.querySelector( `img[srcset*="${ entry.name }"]` );
				const hasImage = articleMainSection.contains( element ) && ( ! avatarBylines || ! avatarBylines.contains( element ) );

				// Look for videos with the src containing the entity name.
				const videoElement = document.querySelector( `video[src*="${ entry.name }"]` );
				const hasVideo     = articleMainSection.contains( videoElement );

				return hasImage || hasVideo;
			} );
		}
		return entries;
	}
</script>
<?php
}

/**
 * Disable analytics script injection in the iframe preview to avoid a
 * conflict with media weight measurements.
 */
function disable_analytics_script_injection() {
	if ( ! isset( $_GET['mediaWeight'] ) ) {
		return;
	}

	remove_action( 'wp_head', 'Altis\Analytics\\enqueue_scripts', 0 );
}

/**
 * Disable lazy loading for iframes in media weight preview.
 *
 * @param bool $lazy Whether lazy loading is enabled.
 * @return bool Modified lazy loading setting.
 */
function disable_lazy_loading_for_iframes_in_preview( $lazy ) {
	if ( isset( $_GET['mediaWeight'] ) ) {
		return false;
	}
	return $lazy;
}

/**
 * Add a shimmer style for media weight loading states to wp-admin footer.
 */
function output_shimmer_styles() : void {
	?>
	<style>
		/* Shimmer effect for loading */
		@keyframes shimmer {
			0% {
				background-position: -200px 0;
			}
			100% {
				background-position: 200px 0;
			}
		}
		.media-weight-placeholder {
			animation-duration: 1.5s;
			animation-fill-mode: forwards;
			animation-iteration-count: infinite;
			animation-name: shimmer;
			animation-timing-function: linear;
			background: #f6f7f8;
			background: linear-gradient(to right, #eeeeee 8%, #dddddd 18%, #eeeeee 33%);
			background-size: 800px 104px;
			position: relative;
		}
	</style>
	<?php
}

/**
 * Remove autoplay from videos in the media weight preview.
 *
 * Filters the html of the core video block to remove the autoplay attribute.
 */
function remove_video_autoplay_in_preview( $block_content, $block ) {
	if ( ! isset( $_GET['mediaWeight'] ) ) {
		return $block_content;
	}

	if ( 'core/video' === $block['blockName'] ) {
		$block_content = str_replace( ' autoplay="autoplay"', '', $block_content );
		$block_content = str_replace( ' autoplay', '', $block_content );
	}

	return $block_content;
}