import { useMemo } from 'react';
import { __ } from '@wordpress/i18n';
import { image, media } from '@wordpress/icons';
import { PluginSidebar, PluginSidebarMoreMenuItem } from '@wordpress/editor';
import { PanelBody } from '@wordpress/components';
import { registerPlugin, unregisterPlugin } from '@wordpress/plugins';
import { useSelect } from '@wordpress/data';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { useEntityRecords } from '@wordpress/core-data';

const PLUGIN_NAME = 'altis-media-weight';
const SIDEBAR_NAME = PLUGIN_NAME;

const getMediaBlocks = ( blocks ) => blocks.reduce(
	( mediaBlocks, block ) => {
		if ( [ 'core/image', 'core/video' ].includes( block.name ) ) {
			mediaBlocks.push( block );
		}
		if ( block.innerBlocks ) {
			return mediaBlocks.concat( getMediaBlocks( block.innerBlocks ) );
		}
		return mediaBlocks;
	},
	[]
);

const useMediaBlocks = () => {
	const blocks = useSelect( ( select ) => select( blockEditorStore ).getBlocks() );
	const { imageIds, videoIds } = useMemo( () => {
		const mediaBlocks = getMediaBlocks( blocks );
		const imageIds = [];
		const videoIds = [];
		for ( let block of mediaBlocks ) {
			if ( ! block.attributes?.id ) {
				continue;
			}
			if ( block.name === 'core/image' ) {
				imageIds.push( block.attributes.id );
			} else if ( block.name === 'core/video' ) {
				videoIds.push( block.attributes.id );
			}
		}
		return { imageIds, videoIds };
	}, [ blocks ] );
	return useEntityRecords( 'postType', 'attachment', {
		per_page: imageIds.length,
		include: imageIds,
	} )?.records || [];
};

const AltisMediaWeightSidebar = ( ...args ) => {
	const mediaBlocks = useMediaBlocks();
	console.log( mediaBlocks );

	return (
		<>
			<PluginSidebarMoreMenuItem target={ SIDEBAR_NAME }>
				{ __( 'Media Weight sidebar', 'altis-media-weight' ) }
			</PluginSidebarMoreMenuItem>
			<PluginSidebar name={ SIDEBAR_NAME } title={ __( 'Media Weight', 'altis-media-weight' ) }>
				<PanelBody>
					{ mediaBlocks.map( ( block ) => (
						<pre key={ `media-block-${ block.clientId }` }>
							{ JSON.stringify( block, null, 2 ) }
						</pre>
					) ) }
				</PanelBody>
			</PluginSidebar>
		</>
	);
};

registerPlugin( PLUGIN_NAME, {
	icon: media,
	render: AltisMediaWeightSidebar,
} );

// Block HMR boilerplate.
if ( module.hot ) {
	module.hot.accept();
	module.hot.dispose( () => unregisterPlugin( PLUGIN_NAME ) );
}
