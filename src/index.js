import { useMemo, useState, useCallback } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { PluginSidebar } from '@wordpress/editor';
import {
	PanelBody,
	Button,
	SelectControl,
	Notice,
	Flex,
	Icon,
} from '@wordpress/components';
import { registerPlugin, unregisterPlugin } from '@wordpress/plugins';
import { useSelect } from '@wordpress/data';
import { useEffect } from '@wordpress/element';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { useEntityRecords } from '@wordpress/core-data';
import { check, warning, closeSmall, image, video } from '@wordpress/icons';
import { addQueryArgs } from '@wordpress/url';

import { ReactComponent as ScalesIcon } from './assets/scale-icon.svg';

const { mediaThreshold } = window.mediaWeightData;

const PLUGIN_NAME = 'hm-media-weight';
const SIDEBAR_NAME = PLUGIN_NAME;
const MB_IN_B = 1024 * 1024;

const previewPlatforms = {
	mobile: {
		label: __( 'Mobile', 'hm-media-weight' ),
		width: '390px',
		height: '844px',
		slug: 'mobile',
	},
	desktop: {
		label: __( 'Desktop', 'hm-media-weight' ),
		width: '1920px',
		height: '1080px',
		slug: 'desktop',
	},
};

// Skeleton loading placeholder component.
const SkeletonBox = ( { width = '100%', height = '16px', style = {} } ) => (
	<div
		aria-hidden="true"
		style={ {
			width,
			height,
			backgroundColor: '#e0e0e0',
			borderRadius: '4px',
			background: 'linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)',
			backgroundSize: '200px 100%',
			animation: 'shimmer 1.5s infinite linear',
			...style,
		} }
	/>
);

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
	const { imageIds, videoIds } = useMemo( () => {
		const imageIds = [];
		const videoIds = [];
		for ( const block of mediaBlocks ) {
			if ( ! block.attributes?.id ) {
				continue;
			}
			if ( block.name === 'core/image' ) {
				imageIds.push( block.attributes.id );
			} else if ( block.name === 'core/video' ) {
				videoIds.push( block.attributes.id );
			}
		}
		if ( featuredImageId !== 0 ) {
			imageIds.push( featuredImageId );
		}
		return { imageIds, videoIds };
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
	};
};

const HMMediaWeightSidebar = () => {
	const {
		attachments,
	} = useMediaBlocks();

	// Performance API (“preview”) entries state.
	const [ previewEntries, setPreviewEntries ] = useState( [] );

	// Track fetching of preview to show a spinner.
	const [ isFetchingPreview, setIsFetchingPreview ] = useState( false );

	// Track the preview calculation mode: default to 'mobile', the other option is 'desktop'.
	const [ previewPlatform, setPreviewPlatform ] = useState( 'mobile' );

	// Track the iframe URL in state.
	const [ iframeURL, setIframeURL ] = useState( null );

	const mediaWeightHeader = sprintf(
			/* translators: %s: Preview mode (mobile or desktop). */
			__( '%s media weight', 'hm-media-weight' ),
			previewPlatforms[ previewPlatform ].label
		);

	// Skeleton loader to mimic the loaded state layout.
	const MediaWeightSkeleton = () => (
		<Flex direction="column" gap={ 4 } aria-label={ __( 'Loading media weight data…', 'hm-media-weight' ) }>
			<div>
				<p style={ { fontWeight: 600, marginBottom: '8px' } }>
					{ mediaWeightHeader }
				</p>
				{ /* Status badge with shimmer background */ }
				<div
					aria-hidden="true"
					style={ {
						borderRadius: '4px',
						padding: '8px 10px',
						border: '1px solid #e0e0e0',
						background: 'linear-gradient(90deg, #f0f0f0 25%, #fafafa 50%, #f0f0f0 75%)',
						backgroundSize: '200px 100%',
						animation: 'shimmer 1.5s infinite linear',
					} }
				>
					<Flex gap={ 2 } align="center" justify="flex-start">
						<SkeletonBox width="20px" height="20px" style={ { flexShrink: 0 } } />
						<SkeletonBox width="65px" height="20px" style={ { flexShrink: 0 } } />
						<SkeletonBox width="55px" height="18px" style={ { flexShrink: 0 } } />
					</Flex>
				</div>
			</div>

			{ /* Skeleton for media breakdown */ }
			<Flex direction="column" gap={ 2 }>
				<Flex gap={ 2 } align="center" justify="flex-start">
					<SkeletonBox width="20px" height="20px" style={ { flexShrink: 0 } } />
					<SkeletonBox width="150px" height="18px" style={ { flexShrink: 0 } } />
				</Flex>
				<Flex gap={ 2 } align="center" justify="flex-start">
					<SkeletonBox width="20px" height="20px" style={ { flexShrink: 0 } } />
					<SkeletonBox width="145px" height="18px" style={ { flexShrink: 0 } } />
				</Flex>
			</Flex>
		</Flex>
	);

	const previewPostLink = useSelect( ( select ) => select( 'core/editor' ).getEditedPostPreviewLink() );
	useEffect( () => {
		setIframeURL(
			previewPostLink ?
			addQueryArgs( previewPostLink, { mediaWeight: '1', previewPlatform, d: Date.now() } ) :
			null
		);
	}, [ previewPostLink, previewPlatform ] );

	const removePreviewIframe = () => {
		const iframeToRemove = document.getElementById( 'post-preview-iframe' );
		if ( iframeToRemove ) {
			iframeToRemove.remove();
		}
	};

	const insertPreviewIframe = useCallback( ( url, platform = 'mobile' ) => {
		const { width, height } = previewPlatforms[ platform ];
		setIsFetchingPreview( true );

		// Remove existing iframe to ensure a fresh sized load.
		removePreviewIframe();

		const iframe = document.createElement( 'iframe' );
		iframe.id = 'post-preview-iframe';

		// Parse numeric values from width/height (remove 'px' suffix).
		const numericWidth = parseInt( width, 10 );
		const numericHeight = parseInt( height, 10 );

		// Position iframe off-screen but visible.
		iframe.width            = numericWidth;
		iframe.height           = numericHeight;
		iframe.style.width      = width;
		iframe.style.height     = height;
		iframe.style.minWidth   = width;
		iframe.style.minHeight  = height;
		iframe.style.maxWidth   = 'none';
		iframe.style.position   = 'fixed';
		iframe.style.left       = '-9999px';
		iframe.style.top        = '0';
		iframe.style.border     = 'none';
		iframe.style.visibility = 'visible';
		iframe.src              = url;

		document.body.appendChild( iframe );
	}, [] );

	useEffect( () => {
		if ( ! iframeURL ) {
			return;
		}

		// Only trigger once the plugin sidebar is actually in the DOM (i.e. opened).
		const sidebarSelector = `.${ SIDEBAR_NAME }`;
		let tries = 0;
		const maxTries = 50; // ~5s at 100ms

		const intervalId = window.setInterval( () => {
			tries++;
			const sidebarIsOpen = Boolean( document.querySelector( sidebarSelector ) );

			if ( ! sidebarIsOpen ) {
				if ( tries >= maxTries ) {
					window.clearInterval( intervalId );
				}
				return;
			}

			window.clearInterval( intervalId );
			setPreviewEntries( [] );
			insertPreviewIframe( iframeURL, previewPlatform );
		}, 100 );

		return () => {
			window.clearInterval( intervalId );
		};
	}, [ iframeURL, insertPreviewIframe, previewPlatform ] );

	useEffect( () => {
		const listener = ( event ) => {
			let receivedEntries = event.data;

			try {
				receivedEntries = JSON.parse( receivedEntries );
			} catch ( e ) {
				// Not our payload.
				return;
			}

			// Select only images and videos.
			const filteredEntries = receivedEntries.filter( ( entry ) => {
				return entry.initiatorType === 'img' || entry.initiatorType === 'video';
			} );

			const nextPreviewEntries = filteredEntries
				.map( ( entry ) => {
					const previewSize = entry.transferSize || entry.encodedBodySize || 0;

					return {
						previewSize,
						initiatorType: entry.initiatorType,
						url: entry.name,
					};
				} )
				.filter( Boolean );

			// Filter entries with duplicate urls, keeping the largest previewSize.
			const uniqueEntriesMap = new Map();
			for ( const entry of nextPreviewEntries ) {
				if ( uniqueEntriesMap.has( entry.url ) ) {
					const existingEntry = uniqueEntriesMap.get( entry.url );
					if ( entry.previewSize > existingEntry.previewSize ) {
						uniqueEntriesMap.set( entry.url, entry );
					}
				} else {
					uniqueEntriesMap.set( entry.url, entry );
				}
			}
			const uniquePreviewEntries = Array.from( uniqueEntriesMap.values() );

			/**
			 * Filter out external resources, for example images inserted from other domains.
			 *
			 * For cross-origin resources like third-party images, performance.getEntriesByType('resource') will return
			 * entries, but transferSize and encodedBodySize will be 0 unless the server includes the Timing-Allow-Origin header.
			 * Regardless, we want to make sure they are excluded from our calculations because they aren't part
			 * of the page weight.
			 */
			const localDomain = window.location.hostname;
			const finalPreviewEntries = uniquePreviewEntries.filter( ( entry ) => {
				try {
					const entryURL = new URL( entry.url );
					return entryURL.hostname === localDomain;
				} catch ( e ) {
					return false;
				}
			} );

			setPreviewEntries( finalPreviewEntries );
			setIsFetchingPreview( false );
		};

		window.addEventListener( 'message', listener );

		return () => {
			window.removeEventListener( 'message', listener );
		};
	}, [ attachments ] );

	let previewBytesTotal = previewEntries.reduce( ( total, entry ) => total + ( entry.previewSize || 0 ), 0 );

	previewBytesTotal = ( previewBytesTotal / MB_IN_B ).toFixed( 2 );

	// Determine status level for accessibility (not just color)
	let sizeStatus;
	if ( previewBytesTotal >= 0 && previewBytesTotal <= ( mediaThreshold / 2 ) ) {
		sizeStatus = 'good';
	} else if ( previewBytesTotal >= ( mediaThreshold / 2 ) && previewBytesTotal <= mediaThreshold ) {
		sizeStatus = 'warning';
	} else {
		sizeStatus = 'error';
	}

	// Status configuration for colors, icons, and labels
	const statusConfig = {
		good: {
			color: '#00a32a',
			backgroundColor: '#edfaef',
			icon: check,
			label: __( 'Good', 'hm-media-weight' ),
		},
		warning: {
			color: '#dba617',
			backgroundColor: '#fcf9e8',
			icon: warning,
			label: __( 'Warning', 'hm-media-weight' ),
		},
		error: {
			color: '#d63638',
			backgroundColor: '#fcf0f1',
			icon: closeSmall,
			label: __( 'Over limit', 'hm-media-weight' ),
		},
	};

	const currentStatus = statusConfig[ sizeStatus ];

	// Filter previewEntries by image and video.
	const imagePreviewEntries = previewEntries.filter( ( entry ) => entry.initiatorType === 'img' );
	const videoPreviewEntries = previewEntries.filter( ( entry ) => entry.initiatorType === 'video' );

	// Total the image and video sizes from the preview data.
	const imagePreviewEntriesSize = imagePreviewEntries.reduce( ( total, entry ) => total + ( entry.previewSize || 0 ), 0 ) / MB_IN_B;
	const videoPreviewEntriesSize = videoPreviewEntries.reduce( ( total, entry ) => total + ( entry.previewSize || 0 ), 0 ) / MB_IN_B;

	// Platform options for SelectControl
	const platformOptions = Object.entries( previewPlatforms ).map( ( [ key, { label } ] ) => ( {
		value: key,
		label,
	} ) );

	// Disable the button when fetching.
	return (
		<PluginSidebar className={ SIDEBAR_NAME } title={ __( 'Media Weight', 'hm-media-weight' ) }>
			<PanelBody initialOpen={ true }>
				<Flex direction="column" gap={ 4 }>
					{ /* Total Media Weight Section */ }
					{ /* Loading Skeleton */ }
					{ isFetchingPreview && <MediaWeightSkeleton /> }

					{ /* Total Media Weight Section
					The label will read "Mobile media weight" or "Desktop media weight" depending on the selected platform. */ }
					{ ! isFetchingPreview && (
						<div>
							<p style={ { fontWeight: 600, marginBottom: '8px' } }>
								{ mediaWeightHeader }
							</p>
							{ /* Status badge */ }
							{ previewEntries.length > 0 ? (
								<Flex
									gap={ 2 }
									align="center"
									justify="center"
									style={ {
										backgroundColor: currentStatus.backgroundColor,
										borderRadius: '4px',
										padding: '8px 12px',
										border: `1px solid ${ currentStatus.color }`,
									} }
								>
									<Icon
										icon={ currentStatus.icon }
										style={ { fill: currentStatus.color, flexShrink: 0 } }
										size={ 20 }
									/>
									<span
										style={ { fontWeight: 600, color: currentStatus.color, fontSize: '16px' } }
									>
										{ previewBytesTotal } MB
									</span>
									<span
										style={ { color: currentStatus.color } }
										aria-label={ sprintf(
											/* translators: %s: Status label (Good, Warning, or Over limit). */
											__( 'Status: %s', 'hm-media-weight' ),
											currentStatus.label
										) }
									>
										({ currentStatus.label })
									</span>
								</Flex>
							) : (
								<div className="components-text is-secondary">
									{ __( 'No data yet. Click refresh to calculate.', 'hm-media-weight' ) }
								</div>
							) }
						</div>
					) }

					{ /* Media Breakdown Section */ }
					{ ! isFetchingPreview && previewEntries.length > 0 && (
						<Flex direction="column" gap={ 2 }>
							<Flex gap={ 2 } align="center" justify="flex-start">
								<Icon icon={ image } size={ 18 } style={ { opacity: 0.7, flexShrink: 0 } } />
								<span>
									{ imagePreviewEntries.length
										? sprintf(
												/* translators: %1$d: Number of images, %2$s: Size in MB. */
												__( '%1$d images (%2$s MB)', 'hm-media-weight' ),
												imagePreviewEntries.length,
												imagePreviewEntriesSize.toFixed( 4 )
										  )
										: __( 'No images (0.00 MB)', 'hm-media-weight' )
									}
								</span>
							</Flex>
							<Flex gap={ 2 } align="center" justify="flex-start">
								<Icon icon={ video } size={ 18 } style={ { opacity: 0.7, flexShrink: 0 } } />
								<span>
									{ videoPreviewEntries.length
										? sprintf(
												/* translators: %1$d: Number of videos, %2$s: Size in MB. */
												__( '%1$d videos (%2$s MB)', 'hm-media-weight' ),
												videoPreviewEntries.length,
												videoPreviewEntriesSize.toFixed( 4 )
										  )
										: __( 'No videos (0.00 MB)', 'hm-media-weight' )
									}
								</span>
							</Flex>
						</Flex>
					) }

					{ /* Warning Notice */ }
					{ ! isFetchingPreview && sizeStatus === 'error' && (
						<Notice
							status="error"
							isDismissible={ false }
						>
							{ sprintf(
								/* translators: %s: Maximum allowed size (in megabytes) for all media on page. */
								__( 'Media weight exceeds the recommended threshold of %s MB. Consider optimizing your images or using smaller file sizes.', 'hm-media-weight' ),
								mediaThreshold
							) }
						</Notice>
					) }

					{ /* Warning for approaching limit */ }
					{ ! isFetchingPreview && sizeStatus === 'warning' && (
						<Notice
							status="warning"
							isDismissible={ false }
						>
							{ sprintf(
								/* translators: %s: Maximum allowed size (in megabytes) for all media on page. */
								__( 'Media weight is approaching the recommended threshold of %s MB.', 'hm-media-weight' ),
								mediaThreshold
							) }
						</Notice>
					) }

					{ /* Platform Selection */ }
					<SelectControl
						label={ __( 'Preview platform', 'hm-media-weight' ) }
						value={ previewPlatform }
						options={ platformOptions }
						onChange={ setPreviewPlatform }
						help={ sprintf(
							/* translators: %s: Preview mode (mobile or desktop). */
							__( 'Media weight reflects all media loaded on a %s viewport.', 'hm-media-weight' ),
							previewPlatforms[ previewPlatform ].label
						) }
						__nextHasNoMarginBottom
					/>

					{ /* Refresh Button */ }
					<Button
						variant="secondary"
						onClick={ () => insertPreviewIframe( iframeURL, previewPlatform ) }
						disabled={ isFetchingPreview }
						aria-label={ __( 'Refresh preview data to recalculate media weight', 'hm-media-weight' ) }
					>
						{ __( 'Refresh Preview Data', 'hm-media-weight' ) }
					</Button>
				</Flex>
			</PanelBody>
		</PluginSidebar>
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
