<?php
/**
 * Main plugin namespace.
 */

namespace HM_Media_Weight;

const ATTACHMENT_SIZE_CRON_ID = 'hm-media-weight-attachment-check';
const ATTACHMENT_SIZE_META_KEY = 'intermediate_image_filesizes';

/**
 * Connect namespace functions to actions and hooks.
 */
function bootstrap() : void {
	add_action( 'init', __NAMESPACE__ . '\register_attachment_meta' );
	add_action( 'add_attachment', __NAMESPACE__ . '\\schedule_file_size_check' );
	add_action( ATTACHMENT_SIZE_CRON_ID, __NAMESPACE__ . '\\store_intermediate_file_sizes' );
	add_action( 'rest_prepare_attachment', __NAMESPACE__ . '\\lookup_file_sizes_as_needed_during_rest_response', 10, 3 );
}

/**
 * Registers the _image_file_sizes meta field for the attachment post type.
 */
function register_attachment_meta() {
	register_post_meta( 'attachment', ATTACHMENT_SIZE_META_KEY, [
		'type'         => 'object',
		'description'  => 'File sizes for all intermediate image sizes of an attachment.',
		'single'       => true,
		'show_in_rest' => [
			'schema' => [
				'type' => 'object',
				'additionalProperties' => [
					'type' => 'integer',
				],
			],
		],
		'auth_callback' => function() {
			return current_user_can( 'edit_posts' );
		},
	] );
}

/**
 * Schedules a cron job to check file sizes for the uploaded attachment.
 *
 * @param int $attachment_id The ID of the uploaded attachment.
 */
function schedule_file_size_check( $attachment_id ) {
	if ( ! in_array( get_post_mime_type( $attachment_id ), [ 'image/jpeg', 'image/png', 'image/gif' ], true ) ) {
		return;
	}

	if ( ! wp_next_scheduled( ATTACHMENT_SIZE_CRON_ID, [ $attachment_id ] ) ) {
		// Ensure the cron job is scheduled for later as fallback.
		wp_schedule_single_event( time(), ATTACHMENT_SIZE_CRON_ID, [ $attachment_id ] );
	}
}

/**
 * Logs the file sizes for each image size of the uploaded attachment.
 *
 * Image weights are retrieved via remote request against the image's URI.
 *
 * @param int $attachment_id The ID of the uploaded attachment.
 */
function store_intermediate_file_sizes( $attachment_id ) {
	/**
	 * Filter which size slugs we retrieve image size information for.
	 *
	 * Enables a site from skipping computation (remote request) for any size
	 * slugs that are explicitly not expected/allowed to be used in posts.
	 *
	 * @param string[] $calculated_image_sizes Maximum number of megabytes of media permitted per post.
	 */
	$image_sizes = apply_filters( 'hm_media_weight_calculated_sizes', get_intermediate_image_sizes() );
	$file_sizes  = [];

	foreach ( $image_sizes as $size ) {
		$image_url = wp_get_attachment_image_url( $attachment_id, $size );

		if ( ! $image_url ) {
			continue;
		}

		// Pass an Accept header to ensure we'll get webp sizing results if that
		// format is supported by the server.
		$args = [
			'headers' => [ 'Accept' => 'image/webp' ],
		];
		$response = wp_remote_head( $image_url, $args );

		if ( is_wp_error( $response ) ) {
			continue;
		}

		$headers = wp_remote_retrieve_headers( $response );
		if ( ! empty( $headers['content-length'] ) ) {
			$file_sizes[ $size ] = (int) $headers['content-length'];
			continue;
		}

		// If head request didn't work, server may not expose response content-length.
		// Instead, try a get and read the response string's length. This is obviously
		// less efficient, but measures accurately.
		$response = wp_remote_get( $image_url, $args );

		if ( is_wp_error( $response ) ) {
			continue;
		}

		if ( ( $response['response']['code'] ?? null ) === 200 && ! empty( $response['body'] ) ) {
			$file_sizes[ $size ] = (int) strlen( $response['body'] );
		}
	}

	// Save the file sizes to the attachment meta.
	update_post_meta( $attachment_id, ATTACHMENT_SIZE_META_KEY, $file_sizes );
}

/**
 * Retrieves the file sizes for an attachment.
 *
 * @param int $attachment_id The ID of the attachment.
 * @return array|null The array of file sizes keyed by URL, or null if not available.
 */
function get_file_sizes( $attachment_id ) {
	return get_post_meta( $attachment_id, ATTACHMENT_SIZE_META_KEY, true ) ?: [];
}

/**
 * Conditionally request and fill in missing file size meta before fulfilling
 * an edit-context REST request for an image.
 *
 * @param WP_REST_Response $response The response object.
 * @param WP_Post          $post     The original attachment post.
 * @param WP_REST_Request  $request  Request used to generate the response.
 * @return WP_REST_Response The filtered response.
 */
function lookup_file_sizes_as_needed_during_rest_response( $response, $post, $request ) {
	if ( $request->get_param( 'context' ) !== 'edit' ) {
		return $response;
	}

	if ( ! empty( $response->data['meta'][ ATTACHMENT_SIZE_META_KEY ] ?? null ) ) {
		return $response;
	}

	$meta_field_included = rest_is_field_included(
		'meta.' . ATTACHMENT_SIZE_META_KEY,
		get_post_type_object( 'attachment' )->get_rest_controller()->get_fields_for_response( $request ) ?? []
	);
	if ( ! $meta_field_included ) {
		return $response;
	}

	// Update post meta and then append the stored values to the response.
	store_intermediate_file_sizes( $post->ID );
	$response->data['meta'][ ATTACHMENT_SIZE_META_KEY ] = get_file_sizes( $post->ID );

	// Ensure we consistently return object-shaped JSON, not `[]` for empty.
	if ( empty( $response->data['meta'][ ATTACHMENT_SIZE_META_KEY ] ) && isset( $response->data['meta'][ ATTACHMENT_SIZE_META_KEY ] ) ) {
		$response->data['meta'][ ATTACHMENT_SIZE_META_KEY ] = (object) [];
	}

	return $response;
}
