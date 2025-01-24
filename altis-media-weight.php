<?php
/**
 * Plugin Name:       HM Media Weight
 * Description:       Block Editor plugin to monitor media bandwidth usage.
 * Requires PHP:      8.1
 * Version:           0.1.0
 * Author:            Human Made Ltd
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       hm-media-weight
 */

namespace HM_Media_Weight;

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

/**
 * Connect namespace functions to actions and hooks.
 */
function bootstrap() : void {
	add_action( 'enqueue_block_editor_assets', __NAMESPACE__ . '\\register_block_plugin_editor_scripts' );
	add_action( 'enqueue_block_editor_assets', __NAMESPACE__ . '\\maybe_warn_on_script_debug_mode' );
}
// Initialize plugin.
bootstrap();

/**
 * Registers the block plugin script bundle.
 */
function register_block_plugin_editor_scripts() {
	$asset_file = include( plugin_dir_path( __FILE__ ) . 'build/index.asset.php');

	if ( $asset_file === false ) {
		return;
	}

	wp_enqueue_script(
		'hm-media-weight',
		plugins_url( 'build/index.js', __FILE__ ),
		$asset_file['dependencies'],
		$asset_file['version']
	);

	wp_localize_script(
		'hm-media-weight',
		'mediaWeightData',
		[
			/**
			 * Filter the threshold at which a post is deemed "too heavy" due to media weight.
			 *
			 * @param float $threshold Maxmimum number of megabytes of media permitted per post.
			 */
			'mediaThreshold' => apply_filters( 'hm_media_weight_threshold', 2.50 ),
			/**
			 * Filter the expected maximum width (in pixels) for media displayed in post content.
			 */
			'contentColumnWidth' => apply_filters(
				'hm_media_weight_content_column_width',
				$GLOBALS['content_width'] ?? 1024
			),
			/**
			 * Filter the expected maximum width (in pixels) for a desktop featured image.
			 */
			'featuredImageWidth' => apply_filters(
				'hm_media_weight_featured_image_width',
				$GLOBALS['content_width'] ?? 1024
			),
		]
	);
}

/**
 * Show a warning if SCRIPT_DEBUG is off while we're running the dev server.
 */
function maybe_warn_on_script_debug_mode() {
	// Only render this notice in the post editor.
	if ( ( get_current_screen()->base ?? '' ) !== 'post' ) {
		return;
	}

	$asset_file = include( plugin_dir_path( __FILE__ ) . 'build/index.asset.php');

	if ( ! in_array( 'wp-react-refresh-runtime', $asset_file['dependencies'] ?? [], true ) ) {
		// Either not in hot-reload mode, or plugin isn't currently built.
		return;
	}

	if ( defined( 'SCRIPT_DEBUG' ) && SCRIPT_DEBUG ) {
		// SCRIPT_DEBUG configured correctly.
		return;
	}

	ob_start();
	?>
	wp.domReady( () => {
		wp.data.dispatch( 'core/notices' ).createNotice(
			'warning',
			"<?php echo esc_attr__( 'HM Media Weight plugin is running in hot-reload mode, but SCRIPT_DEBUG is not set.', 'hm-media-weight' ); ?>",
			{
				isDismissible: false,
			}
		);
	} );
	<?php
	wp_add_inline_script( 'wp-data', (string) ob_get_clean() );
}
