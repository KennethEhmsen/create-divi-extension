'use strict';

const autoprefixer                  = require( 'autoprefixer' );
const path                          = require( 'path' );
const webpack                       = require( 'webpack' );
const CaseSensitivePathsPlugin      = require( 'case-sensitive-paths-webpack-plugin' );
const WatchMissingNodeModulesPlugin = require( 'react-dev-utils/WatchMissingNodeModulesPlugin' );
const eslintFormatter               = require( 'react-dev-utils/eslintFormatter' );


// This is the development configuration.
// It is focused on developer experience and fast rebuilds.
// The production configuration is different and lives in a separate file.
module.exports = {
	devtool: 'cheap-module-source-map',
	// These are the "entry points" to our application.
	// This means they will be the "root" imports that are included in JS bundle.
	// The first two entry points enable "hot" CSS and auto-refreshes for JS.
	entry: [
		// Include an alternative client for WebpackDevServer. A client's job is to
		// connect to WebpackDevServer by a socket and get notified about changes.
		// When you save a file, the client will either apply hot updates (in case
		// of CSS changes), or refresh the page (in case of JS changes).
		require.resolve( 'webpack-dev-server/client' ) + '?/',
		require.resolve( 'webpack/hot/dev-server' ),
		// Errors should be considered fatal in development
		require.resolve( 'react-error-overlay' ),
		// Finally, this is your app's code:
		path.resolve( 'module/loader.jsx' ),
	],
	output: {
		// Next line is not used in dev but WebpackDevServer crashes without it:
		path: 'scripts',
		// Add /* filename */ comments to generated require()s in the output.
		pathinfo: true,
		// This does not produce a real file. It's just the virtual path that is
		// served by WebpackDevServer in development. This is the JS bundle
		// containing code from all our entry points, and the Webpack runtime.
		filename: 'scripts/bundle.js',
		// There are also additional JS chunk files if you use code splitting.
		chunkFilename: 'scripts/[name].chunk.js',
		// This is the URL that app is served from. We use "/" in development.
		publicPath: '/',
		// Point sourcemap entries to original disk location
		devtoolModuleFilenameTemplate: info => path.resolve( info.absoluteResourcePath ),
	},
	resolve: {
		extensions: ['.js', '.json', '.jsx'],
	},
	module: {
		// Make missing exports a compile-time error.
		strictExportPresence: true,
		rules: [
			{
				parser: {
					requireEnsure: false
				}
			},

			// First, run the linter. It's important to do this before Babel processes the JS.
			{
				test: /\.(js|jsx)$/,
				enforce: 'pre',
				use: [
					{
						options: {
							formatter: eslintFormatter,
							ignore: false,
							useEslintrc: true,
						},
						loader: require.resolve( 'eslint-loader' ),
					},
				],
				include: `${__dirname}/**/*.jsx?`,
			},
			// ** ADDING/UPDATING LOADERS **
			// The "file" loader handles all assets unless explicitly excluded.
			// The `exclude` list *must* be updated with every change to loader extensions.
			// When adding a new loader, you must add its `test`
			// as a new entry in the `exclude` list for "file" loader.

			// "file" loader makes sure those assets get served by WebpackDevServer.
			// When you `import` an asset, you get its (virtual) filename.
			// In production, they would get copied to the `build` folder.
			{
				exclude: [
					/\.html$/,
					/\.(js|jsx)$/,
					/\.css$/,
					/\.json$/,
					/\.bmp$/,
					/\.gif$/,
					/\.jpe?g$/,
					/\.png$/,
				],
				loader: require.resolve( 'file-loader' ),
				options: {
					name: 'static/media/[name].[hash:8].[ext]',
				},
			},
			// "url" loader works like "file" loader except that it embeds assets
			// smaller than specified limit in bytes as data URLs to avoid requests.
			// A missing `test` is equivalent to a match.
			{
				test: [/\.bmp$/, /\.gif$/, /\.jpe?g$/, /\.png$/],
				loader: require.resolve( 'url-loader' ),
				options: {
					limit: 10000,
					name: 'static/media/[name].[hash:8].[ext]',
				},
			},
			// Process JS with Babel.
			{
				test: /\.(js|jsx)$/,
				include: `${__dirname}/**/*.jsx?`,
				loader: require.resolve( 'babel-loader' ),
				options: {
					compact: false,
					plugins: [
						'transform-object-rest-spread',
						'transform-class-properties',
					],
					presets: [
						'react',
						['env', { modules: false }],
					],
					// This is a feature of `babel-loader` for webpack (not Babel itself).
					// It enables caching results in ./node_modules/.cache/babel-loader/
					// directory for faster rebuilds.
					cacheDirectory: true,
				},
			},
			// "postcss" loader applies autoprefixer to our CSS.
			// "css" loader resolves paths in CSS and adds assets as dependencies.
			// "style" loader turns CSS into JS modules that inject <style> tags.
			// In production, we use a plugin to extract that CSS to a file, but
			// in development "style" loader enables hot editing of CSS.
			{
				test: /\.css$/,
				use: [
					require.resolve( 'style-loader' ),
					{
						loader: require.resolve( 'css-loader' ),
						options: {
							importLoaders: 1,
						},
					},
					{
						loader: require.resolve( 'postcss-loader' ),
						options: {
							ident: 'postcss', // https://webpack.js.org/guides/migrating/#complex-options
							plugins: () => [
								require( 'postcss-flexbugs-fixes' ),
								autoprefixer( {
									browsers: [
										'>1%',
										'last 4 versions',
										'Firefox ESR',
										'not ie < 10', // React doesn't support IE8 anyway
									],
									flexbox: 'no-2009',
								} ),
							],
						},
					},
				],
			},
			// ** STOP ** Are you adding a new loader?
			// Remember to add the new extension(s) to the "file" loader exclusion list.
		],
	},
	plugins: [
		// Add module names to factory functions so they appear in browser profiler.
		new webpack.NamedModulesPlugin(),
		// Makes some environment variables available to the JS code, for example:
		new webpack.DefinePlugin( {
			'process.env.NODE_ENV': JSON.stringify( 'production' ),
		} ),
		// This is necessary to emit hot updates (currently CSS only):
		new webpack.HotModuleReplacementPlugin(),
		// Watcher doesn't work well if you mistype casing in a path so we use
		// a plugin that prints an error when you attempt to do this.
		// See https://github.com/facebookincubator/create-react-app/issues/240
		new CaseSensitivePathsPlugin(),
		// If you require a missing module and then `npm install` it, you still have
		// to restart the development server for Webpack to discover it. This plugin
		// makes the discovery automatic so you don't have to restart.
		// See https://github.com/facebookincubator/create-react-app/issues/186
		new WatchMissingNodeModulesPlugin( path.resolve( './node_modules' ) ),
	],
	// Turn off performance hints during development because we don't do any
	// splitting or minification in interest of speed. These warnings become
	// cumbersome.
	performance: {
		hints: false,
	},
	externals: {
		jquery: 'jQuery',
		react: 'React',
		'react-dom': 'ReactDOM',
		'et-builder-component-registry': 'ETBuilderComponentRegistry',
	},
};
