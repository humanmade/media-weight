import { useMemo } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { PluginSidebar, PluginSidebarMoreMenuItem } from '@wordpress/editor';
import { PanelRow, PanelBody, Button } from '@wordpress/components';
import { registerPlugin, unregisterPlugin } from '@wordpress/plugins';
import { useDispatch, useSelect } from '@wordpress/data';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { useEntityRecords } from '@wordpress/core-data';

import { ReactComponent as ScalesIcon } from './assets/scale-icon.svg';

const { mediaThreshold, featuredImageSize } = window.mediaWeightData;

const PLUGIN_NAME = 'hm-media-weight';
const SIDEBAR_NAME = PLUGIN_NAME;
const MB_IN_B = 1024 * 1024;
const KB_IN_B = 1024;

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
	const mediaBlocks = useSelect( ( select ) => getMediaBlocks( select( blockEditorStore ).getBlocks() ) );
	const featuredImageId = useSelect( ( select ) => select( 'core/editor' ).getEditedPostAttribute( 'featured_media' ) );

	/* eslint-disable no-shadow */
	const { imageIds, videoIds, blocksByAttributeId } = useMemo( () => {
		const imageIds = [];
		const videoIds = [];
		const blocksByAttributeId = {};
		for ( const block of mediaBlocks ) {
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
	}, [ mediaBlocks, featuredImageId ] );
	/* eslint-enable no-shadow */

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
		mediaBlocks,
		imageCount: imageIds.length,
		videoCount: videoIds.length,
	};
};

const HMMediaWeightSidebar = () => {
	const {
		attachments,
		featuredImageId,
		blocksByAttributeId,
		mediaBlocks,
		imageCount,
		videoCount
	} = useMediaBlocks();
	const { selectBlock } = useDispatch( blockEditorStore );
	let imagesSize = 0;
	let videosSize = 0;

	// eslint-disable-next-line no-shadow
	const DisplayTotal = ( { imagesSize, videosSize } ) => {
		const total = ( ( imagesSize + videosSize ) / MB_IN_B ).toFixed( 2 );
		let sizeColor;

		if ( total >= 0 && total <= ( mediaThreshold / 2 ) ) {
			sizeColor = '#1db231';
		} else if ( total >= ( mediaThreshold / 2 ) && total <= mediaThreshold ) {
			sizeColor = '#da6201';
		} else {
			sizeColor = '#cf2e2e';
		}

		const warningMsg = total >= mediaThreshold ? (
			<p className="description" style={
				{
					backgroundColor: '#1db231',
					borderRadius: '2px',
					color: '#fff',
					padding: '3px 6px'
				}
			}>
				{ sprintf(
					/* translators: %f: Maximum allowed size (in megabytes) for all media on page. */
					__( 'Warning! The media in this page exceeds the recommended threshold of %fmb', 'hm-media-weight' ),
					mediaThreshold
				) }
			</p>
		) : null;

		return (
			<>
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
				<p>{ __( 'Images total', 'hm-media-weight' ) }: { ( imagesSize / MB_IN_B ).toFixed( 2 ) }mb</p>
				<p>{ __( 'Videos total', 'hm-media-weight' ) }: { ( videosSize / MB_IN_B ).toFixed( 2 ) }mb</p>
				{ warningMsg }
			</>
		);
	}

	const attachmentSizeDetails = attachments.map( ( attachment ) => {
		const associatedBlockClientId = blocksByAttributeId[ attachment.id ];
		const blockButton = attachment.id !== featuredImageId ? (
			<Button
				className="components-button is-compact is-secondary"
				onClick={ () => selectBlock( associatedBlockClientId ) }
			>
				{ __( 'Select associated block', 'hm-media-weight' ) }
			</Button> ) : '';

		let type = attachment.media_type === 'image' ? __( 'Image', 'hm-media-weight' ) : __( 'Video', 'hm-media-weight' );
		if ( attachment.id === featuredImageId ) {
			type = __( 'Featured image', 'hm-media-weight' );
		}
		let mediaSize = attachment.media_details.filesize;

		if ( attachment.media_type === 'image' ) {
			const requestedSize = attachment.id !== featuredImageId
				? mediaBlocks.find( ( block ) => block.clientId === associatedBlockClientId )?.attributes?.sizeSlug
				: ( featuredImageSize || 'full' );
			// Swap in the actual measured size of the target image, if available.
			mediaSize = attachment.meta?.intermediate_image_filesizes?.[ requestedSize ] || mediaSize;
			imagesSize = imagesSize + mediaSize;
		} else {
			videosSize = videosSize + mediaSize;
		}

		const thumbnail = attachment.media_type === 'image'
			? ( attachment?.media_details?.sizes?.thumbnail?.source_url || attachment.source_url )
			: null;

		return {
			attachment,
			thumbnail,
			type,
			mediaSize,
			blockButton
		};
	} );

	return (
		<>
			<PluginSidebarMoreMenuItem target={ SIDEBAR_NAME }>
				{ __( 'Media Weight sidebar', 'hm-media-weight' ) }
			</PluginSidebarMoreMenuItem>
			<PluginSidebar className={ SIDEBAR_NAME } name={ SIDEBAR_NAME } title={ __( 'Media Weight', 'hm-media-weight' ) }>
				<PanelBody
					initialOpen={ true }
					title={ __( 'Total Media Items', 'hm-media-weight' ) }
				>
					<p>Images: { imageCount }</p>
					<p>Videos: { videoCount }</p>

					<DisplayTotal
						imagesSize={ imagesSize }
						videosSize={ videosSize }
					/>
				</PanelBody>

				<PanelBody
					initialOpen={ false }
					title={ __( 'Individual Media Items', 'hm-media-weight' ) }
				>
					{ attachmentSizeDetails.map( ( { attachment, thumbnail, type, mediaSize, blockButton } ) => {

						return (
							<PanelRow key={ `media-details-${ attachment.id }` }>
								<div>
									{ thumbnail ? (
										<img
											src={ thumbnail }
											alt=""
											style={ { maxWidth: '100%' } }
										/>
									) : null }
									<p>
										<strong>
											{ type }: {
												( mediaSize < MB_IN_B )
													? `${ ( mediaSize / KB_IN_B ).toFixed( 2 ) }kb`
													: `${ ( mediaSize / MB_IN_B ).toFixed( 2 ) }mb`
											}
										</strong>
									</p>
									<p>
										Attachment ID: { attachment.id }<br />
										<small><a href={ `upload.php?item=${ attachment.id }` }>Go to the attachment post &rsaquo;</a></small>
									</p>
									<details style={ { display: 'none', margin: '0.5rem 0 1rem' } }>
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
			</PluginSidebar>
		</>
	);
};

registerPlugin( PLUGIN_NAME, {
	icon: ScalesIcon,
	render: HMMediaWeightSidebar,
} );

// Block HMR boilerplate.
if ( module.hot ) {
	module.hot.accept();
	module.hot.dispose( () => unregisterPlugin( PLUGIN_NAME ) );
}
