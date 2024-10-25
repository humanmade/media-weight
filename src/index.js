import { __ } from '@wordpress/i18n';
import { media } from '@wordpress/icons';
import { PluginSidebar, PluginSidebarMoreMenuItem } from '@wordpress/editor';
import { registerPlugin, unregisterPlugin } from '@wordpress/plugins';

const PLUGIN_NAME = 'altis-media-weight';
const SIDEBAR_NAME = PLUGIN_NAME;

const Component = () => (
	<>
		<PluginSidebarMoreMenuItem target={ SIDEBAR_NAME }>
			My Sidebar
		</PluginSidebarMoreMenuItem>
		<PluginSidebar name={ SIDEBAR_NAME } title={ __( 'Media Weight', 'altis-media-weight' ) }>
			Content of the sidebar
		</PluginSidebar>
	</>
);

registerPlugin( PLUGIN_NAME, {
	icon: media,
	render: Component,
} );

// Block HMR boilerplate.
if ( module.hot ) {
	module.hot.accept();
	module.hot.dispose( () => unregisterPlugin( PLUGIN_NAME ) );
}
