import { useMemo } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { media } from '@wordpress/icons';
import { PluginSidebar, PluginSidebarMoreMenuItem } from '@wordpress/editor';
import { PanelRow, PanelBody, Button } from '@wordpress/components';
import { registerPlugin, unregisterPlugin } from '@wordpress/plugins';
import { useDispatch, useSelect } from '@wordpress/data';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { useEntityRecords } from '@wordpress/core-data';

const { mediaThreshold } = window.mediaWeightData;

const PLUGIN_NAME = 'hm-media-weight';
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
	const featuredImageId = useSelect( ( select ) => select( 'core/editor' ).getEditedPostAttribute( 'featured_media' ) );
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
		if ( featuredImageId !== 0 ) {
			imageIds.push( featuredImageId );
		}
		return { imageIds, videoIds, blocksByAttributeId };
	}, [ blocks, featuredImageId ] );
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
		featuredImageId,
		blocksByAttributeId,
		imageCount: imageIds.length,
		videoCount: videoIds.length,
	};
};

const HMMediaWeightSidebar = ( ...args ) => {
	const {
		attachments,
		featuredImageId,
		blocksByAttributeId,
		imageCount,
		videoCount
	} = useMediaBlocks();
	const { selectBlock } = useDispatch( blockEditorStore );
	let imagesSize = 0;
	let videosSize = 0;

	const DisplayTotal = ( { imagesSize, videosSize } ) => {
		const total = ( imagesSize + videosSize ).toFixed( 2 );
		let sizeColor;

		if ( total >= 0 && total <= ( mediaThreshold / 2 ) ) {
			sizeColor = '#1db231';
		} else if ( total >= ( mediaThreshold / 2 ) && total <= mediaThreshold ) {
			sizeColor = '#da6201';
		} else {
			sizeColor = '#cf2e2e';
		}

		const warningMsg = total >= mediaThreshold ? (
			<p className="description">
				{ sprintf(
					__( 'Warning! The media in this page exceeds the recommended threshold of %fmb', 'hm-media-weight' ),
					mediaThreshold
				) }
			</p>
		) : null;

		return (
			<>
				<p>{ __( 'Images total', 'hm-media-weight' ) }: { imagesSize.toFixed( 2 ) }mb</p>
				<p>{ __( 'Videos total', 'hm-media-weight' ) }: { videosSize.toFixed( 2 ) }mb</p>
				<p>
					<strong>
						{ __( 'Total media size', 'hm-media-weight' ) }: { ' ' }
						<span style={
							{
								backgroundColor: sizeColor,
								borderRadius: '2px',
								color: '#fff',
								padding: '3px 6px'
							}
						}>
							{ total }mb
						</span>
					</strong>
				</p>
				{ warningMsg }
			</>
		);
	}

	return (
		<>
			<PluginSidebarMoreMenuItem target={ SIDEBAR_NAME }>
				{ __( 'Media Weight sidebar', 'hm-media-weight' ) }
			</PluginSidebarMoreMenuItem>
			<PluginSidebar className={ SIDEBAR_NAME } name={ SIDEBAR_NAME } title={ __( 'Media Weight', 'hm-media-weight' ) }>
				<PanelBody
					initialOpen={ false }
					title={ __( 'Total Media Items', 'hm-media-weight' ) }
				>
					<p>Images: { imageCount }</p>
					<p>Videos: { videoCount }</p>
				</PanelBody>

				<PanelBody
					initialOpen={ false }
					title={ __( 'Individual Media Items', 'hm-media-weight' ) }
				>
					{ attachments.map( ( attachment ) => {
						const blockButton = attachment.id !== featuredImageId ? (
							<Button
								className="components-button is-compact is-secondary"
								onClick={ () => selectBlock( blocksByAttributeId[ attachment.id ] ) }
							>
								{ __( 'Select associated block', 'hm-media-weight' ) }
							</Button> ) : '';

						let type = attachment.media_type === 'image' ? __( 'Image', 'hm-media-weight' ) : __( 'Video', 'hm-media-weight' );
						if ( attachment.id === featuredImageId ) {
							type = __( 'Featured image', 'hm-media-weight' );
						}
						const mediaSize = attachment.media_details.filesize /  1000000;

						if ( attachment.media_type === 'image' ) {
							imagesSize = imagesSize + mediaSize;
						} else {
							videosSize = videosSize + mediaSize;
						}

						return (
							<PanelRow key={ `media-details-${ attachment.id }` }>
								<div>
									<p>
										<strong>
											{ type }: { mediaSize.toFixed( 2 ) }mb
										</strong>
									</p>
									<p>
										Attachment ID: { attachment.id }<br />
										<small><a href={ attachment.link }>Go to the attachment post &rsaquo;</a></small>
									</p>
									<details style={ { margin: '0.5rem 0 1rem' } }>
										<summary>{ __( 'View entity record JSON', 'hm-media-weight' ) }</summary>
										<small>
											<pre>
												{ JSON.stringify( attachment, null, 2 ) }
											</pre>
										</small>
									</details>

									{ blockButton }
									<hr />
								</div>
							</PanelRow>
						);
					} ) }
				</PanelBody>

				<PanelBody
					initialOpen
					title={ __( 'Total Media Size', 'hm-media-weight' ) }
				>
					<DisplayTotal
						imagesSize={ imagesSize }
						videosSize={ videosSize }
					/>
				</PanelBody>
			</PluginSidebar>
		</>
	);
};

registerPlugin( PLUGIN_NAME, {
	icon: media,
	render: HMMediaWeightSidebar,
} );

// Block HMR boilerplate.
if ( module.hot ) {
	module.hot.accept();
	module.hot.dispose( () => unregisterPlugin( PLUGIN_NAME ) );
}
