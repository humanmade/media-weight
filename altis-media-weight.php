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

require_once __DIR__ . '/inc/assets.php';

Assets\bootstrap();
