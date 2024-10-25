import { useMemo } from 'react';
import { __ } from '@wordpress/i18n';
import { media } from '@wordpress/icons';
import { PluginSidebar, PluginSidebarMoreMenuItem } from '@wordpress/editor';
import { PanelRow, PanelBody, Button } from '@wordpress/components';
import { registerPlugin, unregisterPlugin } from '@wordpress/plugins';
import { useDispatch, useSelect } from '@wordpress/data';
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
	const { imageIds, videoIds, blocksByAttributeId } = useMemo( () => {
		const mediaBlocks = getMediaBlocks( blocks );
		const imageIds = [];
		const videoIds = [];
		const blocksByAttributeId = {};
		for ( let block of mediaBlocks ) {
			if ( ! block.attributes?.id ) {
				continue;
			}
			blocksByAttributeId[ block.attributes.id ] = block.clientId;
			if ( block.name === 'core/image' ) {
				imageIds.push( block.attributes.id );
			} else if ( block.name === 'core/video' ) {
				videoIds.push( block.attributes.id );
			}
		}
		return { imageIds, videoIds, blocksByAttributeId };
	}, [ blocks ] );
	const imageRecords = useEntityRecords( 'postType', 'attachment', {
		per_page: imageIds.length,
		include: imageIds,
	} )?.records || [];
	const videoRecords = useEntityRecords( 'postType', 'attachment', {
		per_page: videoIds.length,
		include: videoIds,
	} )?.records || [];
	return {
		attachments: imageRecords.concat( videoRecords ),
		blocksByAttributeId,
	};
};

const AltisMediaWeightSidebar = ( ...args ) => {
	const { attachments, blocksByAttributeId } = useMediaBlocks();
	const { selectBlock } = useDispatch( blockEditorStore );

	return (
		<>
			<PluginSidebarMoreMenuItem target={ SIDEBAR_NAME }>
				{ __( 'Media Weight sidebar', 'altis-media-weight' ) }
			</PluginSidebarMoreMenuItem>
			<PluginSidebar name={ SIDEBAR_NAME } title={ __( 'Media Weight', 'altis-media-weight' ) }>
				<PanelBody>
					{ attachments.map( ( attachment ) => {
						const type = attachment.media_type === 'image' ? 'image' : 'video';
						return (
							<PanelRow key={ `media-details-${ attachment.id }` }>
								<div>
									<p>
										<strong>
											Image { attachment.id }: { ( attachment.media_details.filesize /  1000000 ).toFixed( 2 ) }mb
										</strong>
									</p>
									<small style={ { display: 'block', whiteSpace: 'nowrap' } }>{ attachment.link }</small>
									<details style={ { margin: '0.5rem 0 1rem' } }>
										<summary>{ `json for ${ type } ID ${ attachment.id }` }</summary>
										<pre>
											{ JSON.stringify( attachment, null, 2 ) }
										</pre>
									</details>
									<Button
										className="components-button is-compact is-secondary"
										onClick={ () => selectBlock( blocksByAttributeId[ attachment.id ] ) }
									>
										Select block
									</Button>
								</div>
							</PanelRow>
						);
					} ) }
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
