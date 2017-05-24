const path = require('path');
const webpack = require('webpack');
const _ = require('lodash');
const fs = require('fs-extra');
const browserSync = require('browser-sync');
const devMiddleware = require('webpack-dev-middleware');
const hotMiddleware = require('webpack-hot-middleware');
const WriteFilePlugin = require('write-file-webpack-plugin');
const utils = require('./../utils');
const Build = require('./build');

class Develop extends Build {

    constructor(Webiny, config) {
        super(Webiny, config);
        this.port = _.get(Webiny.getConfig(), 'browserSync.port', 3000);
        this.domain = _.get(Webiny.getConfig(), 'browserSync.domain', 'http://localhost');
    }

    run() {
        const vendorConfigs = this.getVendorConfigs();

        utils.log('--------------------------------------------------------------------------');
        utils.info('Please be patient, the initial webpack build may take a few moments...');
        utils.log('--------------------------------------------------------------------------');

        // Remove all files from build folder
        this.config.apps.map(app => {
            fs.emptyDirSync(utils.projectRoot('public_html') + '/build/' + process.env.NODE_ENV + '/' + app.path);
        });

        if (vendorConfigs) {
            return this.buildConfigs(vendorConfigs).then(() => {
                const appConfigs = this.getAppConfigs();
                this.buildAndWatch(appConfigs);
            });
        }

        const appConfigs = this.getAppConfigs();
        return this.buildAndWatch(appConfigs);
    }

    buildAndWatch(configs) {
        // Write webpack files to disk to trigger BrowserSync injection on CSS
        const wfp = {log: false, test: /^((?!hot-update).)*$/};
        configs.map(config => {
            config.devServer = {outputPath: config.output.path};
            config.plugins.push(new WriteFilePlugin(wfp));
        });

        // Create webpack compiler
        // If we are only building one app we MUST NOT pass an array!!
        // An array causes webpack to treat it as MultiCompiler and it resolves hot update file paths incorrectly thus breaking hot reload
        const compiler = webpack(configs);
        let publicPath = this.domain + '/build/development/';
        if (configs.length === 1) {
            publicPath = this.domain + '/build/development/' + configs[0].name.replace('.', '_') + '/';
        }
        // Run browser-sync server
        const bsConfig = {
            ui: false,
            open: false,
            port: this.port,
            socket: {
                domain: this.domain + ':' + this.port
            },
            server: {
                baseDir: utils.projectRoot('public_html'),
                middleware: [
                    (req, res, next) => {
                        res.setHeader('Access-Control-Allow-Origin', '*');
                        next();
                    },
                    devMiddleware(compiler, {
                        publicPath,
                        noInfo: false,
                        stats: {
                            colors: true
                        }
                    }),
                    hotMiddleware(compiler)
                ]
            },
            watchOptions: {
                ignoreInitial: true,
                ignored: '*.{html,js,json}'
            },
            // Files being watched for changes (add CSS of apps selected for build)
            files: configs.map(c => {
                return c.output.path + '/*.css'
            })
        };

        browserSync(bsConfig);
    }
}

module.exports = Develop;