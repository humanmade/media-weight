# Altis Media Weight

This is a WIP plugin to examine the blocks added to a post and provide informative, in-editor warnings if the page weight grows to a prohibitive size.

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
