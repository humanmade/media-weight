/**
 * Customize wp-scripts Webpack configuration to enable the use of a single
 * runtime chunk in hot-reloading mode. This allows multiple bundles to hot-
 * reload in an intuitive manner, so that we can work on multiple blocks and
 * theme scripts at once from the same HMR devServer.
 */
const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );
// eslint-disable-next-line import/no-extraneous-dependencies -- bundled with wp-scripts.
const { optimize } = require( 'webpack' );

module.exports = defaultConfig;

if ( module.exports.mode === 'production' ) {
	// Disable all codesplitting in production builds. This makes Webpack render
	// smaller files (by removing Webpack's own boilerplate from the output), and
	// avoids each bundle trying to set up its own browser-global module registry.
	module.exports.plugins.push(
		new optimize.LimitChunkCountPlugin( {
			maxChunks: 1,
		} )
	);
} else if (
	process.env.WEBPACK_SERVE === 'true' &&
	process.argv.includes( '--hot' )
) {
	// Running in hot-reloading mode: customize the exported configuration
	// to set a single runtime chunk (necessary for HMR to work across multiple
	// block / theme bundles at once) and allow devServer access from all hosts.
	// This allows HMR to work while running the site in Altis Local Server.
	module.exports = {
		...defaultConfig,
		devServer: {
			...( defaultConfig.devServer || {} ),
			allowedHosts: 'all',
		},
		optimization: {
			...( defaultConfig.optimization || {} ),
			runtimeChunk: 'single',
		},
	};
}
