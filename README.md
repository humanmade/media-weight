# Altis Media Weight

This is a WIP plugin to examine the blocks added to a post and provide informative, in-editor warnings if the page weight grows to a prohibitive size.

## What it does

Currently, all this plugin does is to register a block editor plugin sidebar which you can click on to see the attachment records for all images and videos added to the post via blocks. It is currently aware only of the core image and video blocks.

The sidebar will list the attachment's ID and type with its filesize in megabytes, the URI for the image, a `<details>` tab that can be expanded to view the attachment's entity record as formatted JSON, and a button to select and jump to that block in the editor.

Ideally, it will eventually make accurate estimations of aggregate page size based on the associated media, and display a pre-publish or editor-banner warning when that size goes above a specific threshold.

## Development

Download this plugin, activate it within WordPress, and run the Node build. In Altis, this can be done via the following commands (run them from a terminal in the project `content/plugins/` directory):

```
git clone git@github.com:humanmade/altis-media-weight.git
composer server cli -- plugin activate altis-media-weight
cd altis-media-weight
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
