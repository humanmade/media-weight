# HM Media Weight

This is a WIP plugin to examine the blocks added to a post and provide informative, in-editor warnings if the page weight grows to a prohibitive size.

## What it does

Currently, all this plugin does is to register a block editor plugin sidebar which you can click on to see the attachment records for all images and videos added to the post via blocks. It is currently aware only of the core image and video blocks.

The sidebar will list the attachment's ID and type with its filesize in megabytes, the URI for the image, a `<details>` tab that can be expanded to view the attachment's entity record as formatted JSON, and a button to select and jump to that block in the editor.

File size is calculated based on the retrieved image size (measured off HEAD request `content-length`, or the string length of a GET response body if the HEAD did not return a content length value) for the size of image which is selected in an image block. Image sizes are read off of actual remote image requests for PHP, which are dispatched from a cron job that gets scheduled as soon as an API request is made for a post which has image or video blocks.

## Hooks

### `hm_media_weight_threshold`

Sets the threshold at which a post is deemed "too heavy" due to media weight.

Filter function will receive one `float` argument: the `$threshold`, or maximum number of megabytes of media permitted per post.

Example:

```php
add_filter(
	'hm_media_weight_threshold',
	function( float $threshold ) {
		// We want to be very aggressive about image weight,
		// warn if more than 500kb of media on a post.
		return 0.5;
	}
);
```

### `hm_media_weight_featured_image_size_slug`

Determines the expected image size slug for a desktop featured image.

The filter function receives one `string` argument: the `$size_slug`, defining the string name of the image size which is expected to be used for a desktop featured image.

Example:

```php
add_filter(
	'hm_media_weight_featured_image_size_slug',
	function( string $size_slug ) : string {
		// Our classic theme uses this size image in its single.php template.
		return 'article-16x9';
	}
);
```

## Development

Download this plugin, activate it within WordPress, and run the Node build. In Altis, this can be done via the following commands (run them from a terminal in the project `content/plugins/` directory):

```
git clone git@github.com:humanmade/media-weight.git
composer server cli -- plugin activate media-weight
cd media-weight
nvm use
npm install
npm run build
```
(Please note that these steps assume you are using [nvm](https://github.com/nvm-sh/nvm) to manage Node versions.)

Once the initial plugin is build, you can run the hot-reloading development server with the command

```
npm start
```

While this server is running, changes to plugin files will be automatically reflected in the editor without a page reload.
