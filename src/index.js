import { useEffect, useMemo, useState } from 'react';
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
const MB_IN_B = 1000000;
const KB_IN_B = 1000;

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
	const { imageIds, videoIds, blocksByAttributeId } = useMemo( () => {
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
	}, [ mediaBlocks, featuredImageId ] );
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

/**
 * Use a HEAD request to measure the size of a remote file (in bytes).
 *
 * This is necessary because WordPress doesn't store the filesizes of
 * dynamic (Tachyon/Photon) images in the database.
 *
 * @async
 * @param {string} imageUri URL for a remote image.
 * @returns {Promise<number>} The size of the remote image, in bytes.
 */
async function getFileSize( imageUri ) {
	const response = await fetch( imageUri, { method: 'HEAD' } );

	if ( ! response.ok ) {
		throw new Error( `Failed to fetch: ${ response.status }` );
	}

	const contentLength = response.headers.get( 'Content-Length' );
	if ( ! contentLength ) {
		throw new Error( 'Content-Length header not found.' );
	}

	return parseInt( contentLength, 10 );
}

const imageSizesByUri = {};

/**
 * Cached wrapper for getFileSize, to avoid repeatedly checking the same image.
 *
 * @async
 * @param {string} imageUri URL for a remote image.
 * @returns {number|Promise<number>} The size of the remote image, in bytes.
 */
async function checkImageSize( imageUri ) {
	if ( ! imageSizesByUri[ imageUri ] ) {
		imageSizesByUri[ imageUri ] = getFileSize( imageUri );
	}

	return imageSizesByUri[ imageUri ];
}

const HMMediaWeightSidebar = ( ...args ) => {
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

	const [ resolvedRemoteImageSizes, setResolvedImageSizes ] = useState( {} );
	let targetImageURIs = attachments
		.map( ( attachment ) => {
			if ( attachment.media_type !== 'image' ) {
				return null;
			}
			if ( attachment.id === featuredImageId ) {
				// TODO: Understand via filters the expected size of a featured image,
				// and report the URI of the expected target file for measurement.
				return null;
			}
			const associatedBlockClientId = blocksByAttributeId[ attachment.id ];
			const associatedBlock = mediaBlocks.find( ( block ) => block.clientId === associatedBlockClientId );
			const imageUri = attachment?.media_details?.sizes?.[ associatedBlock?.attributes?.sizeSlug ]?.source_url || null;
			if ( ! imageUri ) {
				return null;
			}
			return [ attachment.id, imageUri ];
		} )
		.filter( Boolean );

	// Create a stable reference for triggering useEffect.
	targetImageURIs = JSON.stringify( targetImageURIs );

	useEffect( () => {
		const imageSizeRequests = JSON.parse( targetImageURIs )
			.map( ( [ id, uri ] ) => {
				return checkImageSize( uri ).then( ( size ) => [ id, size ] );
			} );
		Promise.all( imageSizeRequests ).then( ( sizes ) => {
			const resolvedSizes = sizes.reduce( ( memo, [ id, size ] ) => {
				memo[ id ] = size;
				return memo;
			}, {} );
			setResolvedImageSizes( resolvedSizes );
		} );
	}, [ targetImageURIs ] );

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
			<p className="description">
				{ sprintf(
					__( 'Warning! The media in this page exceeds the recommended threshold of %fmb', 'hm-media-weight' ),
					mediaThreshold
				) }
			</p>
		) : null;

		return (
			<>
				<p>{ __( 'Images total', 'hm-media-weight' ) }: { ( imagesSize / MB_IN_B ).toFixed( 2 ) }mb</p>
				<p>{ __( 'Videos total', 'hm-media-weight' ) }: { ( videosSize / MB_IN_B ).toFixed( 2 ) }mb</p>
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
						let mediaSize = attachment.media_details.filesize;

						if ( attachment.media_type === 'image' ) {
							const remoteImageSize = resolvedRemoteImageSizes[ attachment.id ];
							mediaSize = remoteImageSize || mediaSize;
							imagesSize = imagesSize + ( remoteImageSize || mediaSize );
						} else {
							videosSize = videosSize + mediaSize;
						}

						const thumbnail = attachment.media_type === 'image'
							? ( attachment?.media_details?.sizes?.thumbnail?.source_url || attachment.source_url )
							: null;

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
