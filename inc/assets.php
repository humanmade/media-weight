<?php
/**
 * Asset-related functionality.
 */

declare( strict_types=1 );

namespace HM_Media_Weight\Assets;

/**
 * Connect namespace functions to actions and hooks.
 */
function bootstrap() : void {
	add_action( 'enqueue_block_editor_assets', __NAMESPACE__ . '\\register_block_plugin_editor_scripts' );
	add_action( 'enqueue_block_editor_assets', __NAMESPACE__ . '\\maybe_warn_on_script_debug_mode' );
}

/**
 * Registers the block plugin script bundle.
 */
function register_block_plugin_editor_scripts() {
	$asset_file_path = plugin_dir_path( __DIR__ ) . 'build/index.asset.php';
	$asset_file = include( $asset_file_path );

	if ( $asset_file === false ) {
		return;
	}

	$asset_uri = plugins_url( 'build/index.js', __DIR__ );

	// Check whether a runtime chunk exists, and inject it as a dependency if it does.
	if ( includes_hmr_dependency( $asset_file['dependencies'] ) ) {
		// Try to infer and depend upon our custom runtime chunk (see webpack.config.js).
		$runtime_handle = detect_and_register_runtime_chunk( $asset_file_path, $asset_uri );
		if ( ! empty( $runtime_handle ) ) {
			$asset_file['dependencies'][] = $runtime_handle;
		}
	}

	wp_enqueue_script(
		'hm-media-weight',
		$asset_uri,
		$asset_file['dependencies'],
		( defined( 'SCRIPT_DEBUG' ) && SCRIPT_DEBUG ) ? time() : $asset_file['version']
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
			 * Filter the expected maximum width (in pixels) for a desktop featured image.
			 */
			'featuredImageSize' => apply_filters( 'hm_media_weight_featured_image_size_slug', 'large' ),
		]
	);
}

/**
 * Show a warning if SCRIPT_DEBUG is off while we're running the dev server.
 */
function maybe_warn_on_script_debug_mode() {
	if ( wp_get_environment_type() !== 'local' ) {
		return;
	}

	if ( defined( 'SCRIPT_DEBUG' ) && SCRIPT_DEBUG ) {
		// SCRIPT_DEBUG configured correctly.
		return;
	}

	// Only render this notice in the post editor.
	if ( ( get_current_screen()->base ?? '' ) !== 'post' ) {
		return;
	}

	$asset_file = include( plugin_dir_path( __DIR__ ) . 'build/index.asset.php');

	if ( ! in_array( 'wp-react-refresh-runtime', $asset_file['dependencies'] ?? [], true ) ) {
		// Either not in hot-reload mode, or plugin isn't currently built.
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

/**
 * Check whether a given dependencies array includes any of the handles for HMR
 * runtimes that WordPress will inject by default.
 *
 * @param string[] $dependencies Array of dependency script handles.
 * @return bool Whether any dependency is a react-refresh runtime.
 */
function includes_hmr_dependency( array $dependencies ) : bool {
	return array_reduce(
		$dependencies,
		function( $depends_on_runtime, $dependency_script_handle ) {
			return $depends_on_runtime || $dependency_script_handle === 'wp-react-refresh-runtime';
		},
		false
	);
}

/**
 * Check for a runtime file on disk based on the path of the assets file which
 * requires hot-reloading.
 *
 * @param string $asset_file_path Path to a script's asset.php file.
 * @param string $script_uri      Public URI of the script file, used to infer
 *                                the public URI of the runtime.
 * @return string URI to a valid runtime.js file, or empty string if not found.
 */
function infer_runtime_file_uri( $asset_file_path, $script_uri ) : string {
	// Heuristic: the runtime is expected to be in the same folder, or a parent
	// folder one level up from the target script.
	$expected_runtime_file = dirname( $asset_file_path ) . '/runtime.js';
	if ( is_readable( $expected_runtime_file ) ) {
		// Runtime is a sibling to the target file.
		return str_replace(
			// The contents after the final / will be the script filename.
			// Replace that with runtime.js to load the sibling URI.
			preg_replace( '#.*/#', '', $script_uri ),
			'runtime.js',
			$script_uri
		);
	}

	$expected_runtime_file = dirname( $asset_file_path, 2 ) . '/runtime.js';
	if ( is_readable( $expected_runtime_file ) ) {
		// Runtime is in the parent folder of the target file.
		return str_replace(
			// Trim off one additional folder of hierarchy from the script URI
			// to get the URI of the runtime file in the parent folder.
			preg_replace( '#.*/([^/]+/[^/]+)$#', '$1', $script_uri ),
			'runtime.js',
			$script_uri
		);
		return $expected_runtime_file;
	}

	// No runtime found in the asset directory or asset's parent directory.
	return '';
}

/**
 * Try to identify the location of a runtime chunk file relative to a requested
 * asset, register that chunk as a script if it hasn't been registered already,
 * then return the script handle for use as a script dependency.
 *
 * @param string $asset_file_path Path to a script's asset.php file.
 * @param string $script_uri      Public URI of the script file, used to infer
 *                                the public URI of the runtime.
 * @return string Handle of registered script runtime, or empty string if not found.
 */
function detect_and_register_runtime_chunk( string $asset_file_path, string $script_uri ) : string {
	$runtime_uri = infer_runtime_file_uri( $asset_file_path, $script_uri );
	if ( empty( $runtime_uri ) ) {
		return '';
	}

	// We may have multiple runtimes active, so add a path hash into the handle.
	$runtime_handle = sprintf( 'runtime-%s', md5( $runtime_uri ) );
	if ( ! wp_script_is( $runtime_handle, 'registered' ) ) {
		wp_register_script(
			$runtime_handle,
			$runtime_uri,
			[],
			filemtime( $asset_file_path )
		);
	}

	return $runtime_handle;
}
