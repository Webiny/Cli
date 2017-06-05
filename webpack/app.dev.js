/**
 === NOTES ===
 - in development mode your bundles will be significantly larger in size due to hot-reload code being appended to them
 */
const path = require('path');
const webpack = require('webpack');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const Visualizer = require('webpack-visualizer-plugin');
const _ = require('lodash');
const AssetsPlugin = require('./plugins/Assets');
const i18nPlugin = require('./plugins/i18n');
const ChunkIdsPlugin = require('./plugins/ChunkIds');
const utils = require('./../lib/utils');
let externals = require('./externals');

module.exports = function (app, Webiny) {
    // Construct URL for hot-reload and assets
    const port = _.get(Webiny.getConfig(), 'browserSync.port', 3000);
    const domain = _.get(Webiny.getConfig(), 'browserSync.domain', 'http://localhost');
    const url = domain + ':' + port;

    const sharedResolve = require('./resolve')(app);
    const name = app.name;
    const context = utils.projectRoot(app.sourceFolder);
    const outputPath = path.resolve(utils.projectRoot(), 'public_html/build/development', app.path);

    const i18nPluginInstance = new i18nPlugin();
    const plugins = [
        // Generate custom chunk ids and names
        new ChunkIdsPlugin(),
        new webpack.NoEmitOnErrorsPlugin(),
        new webpack.DefinePlugin({
            'DEVELOPMENT': true,
            'PRODUCTION': false,
            'process.env': {
                'NODE_ENV': JSON.stringify(process.env.NODE_ENV)
            }
        }),
        new webpack.HotModuleReplacementPlugin(),
        new ExtractTextPlugin('app.css'),
        // Parse i18n strings and generate external file with translations
        i18nPluginInstance,
        // Generate meta.json to use for app bootstrap based on generated assets
        new AssetsPlugin({
            manifestVariable: 'window["webinyMeta"]["' + name + '"].chunks'
        }),
        new Visualizer({filename: 'stats.html'})
    ];

    // Check if app has vendor DLL defined
    const dllPath = path.resolve(utils.projectRoot(), 'public_html/build/development', app.path, 'vendor.manifest.json');
    if (utils.fileExists(dllPath)) {
        plugins.push(
            new webpack.DllReferencePlugin({
                context,
                manifest: require(dllPath)
            })
        );
    }

    if (name !== 'Webiny.Core') {
        plugins.push(
            new webpack.DllReferencePlugin({
                context: utils.projectRoot('Apps/Webiny/Js/Core'),
                manifest: utils.projectRoot('public_html/build/development') + '/Webiny_Core/vendor.manifest.json'
            })
        );
    }

    const fileExtensionRegex = /\.(png|jpg|gif|jpeg|mp4|mp3|woff2?|ttf|otf|eot|svg|ico)$/;

    return {
        name: name,
        cache: true,
        watch: false,
        context,
        entry: {
            app: [
                'react-hot-loader/patch',
                'webpack-hot-middleware/client?name=' + name + '&path=' + url + '/__webpack_hmr&quiet=false&noInfo=true&warn=false&overlay=true&reload=false',
                'webpack/hot/only-dev-server',
                './App.js'
            ]
        },
        output: {
            path: outputPath,
            filename: '[name].js',
            chunkFilename: 'chunks/[name].js',
            publicPath: url + '/build/development/' + app.path + '/'
        },
        externals: name === 'Webiny.Core' ? {} : externals,
        plugins: plugins,
        module: {
            rules: [
                {
                    test: /\.(js|jsx)$/,
                    exclude: /node_modules/,
                    include: utils.projectRoot(),
                    use: [
                        {
                            loader: 'babel-loader',
                            options: {
                                presets: [
                                    'es2016',
                                    'es2015',
                                    'react'
                                ],
                                plugins: [
                                    'react-hot-loader/babel',
                                    'transform-async-to-generator',
                                    ['transform-object-rest-spread', {'useBuiltIns': true}],
                                    ['babel-plugin-syntax-dynamic-import'],
                                    ['babel-plugin-transform-builtin-extend', {
                                        globals: ['Error']
                                    }]
                                ]
                            }
                        },
                        'hot-accept-loader',
                        i18nPluginInstance.getLoader()
                    ]
                },
                {
                    test: /\.scss$/,
                    use: ExtractTextPlugin.extract({
                        fallback: 'style-loader',
                        use: ['css-loader', 'resolve-url-loader', 'sass-loader?sourceMap']
                    })
                },
                {
                    test: /\.css$/,
                    use: ['style-loader', {
                        loader: 'css-loader',
                        options: {
                            modules: true,
                            localIdentName: app.path + '_[folder]_[local]'
                        }
                    }]
                },
                {
                    test: /node_modules/,
                    include: fileExtensionRegex,
                    loader: 'file-loader',
                    options: {
                        context: path.resolve(utils.projectRoot(), 'Apps', app.rootAppName, 'node_modules'),
                        name: 'external/[path][name].[ext]'
                    }
                },
                {
                    test: fileExtensionRegex,
                    exclude: /node_modules/,
                    loader: 'file-loader',
                    options: {
                        context: path.resolve(utils.projectRoot(), app.sourceFolder, 'Assets'),
                        name: '[path][name].[ext]'
                    }
                }
            ]
        },
        resolve: sharedResolve,
        resolveLoader: {
            modules: [__dirname + '/loaders', 'node_modules']
        }
    }
};
