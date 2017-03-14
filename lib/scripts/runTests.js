const path = require('path');
const fs = require('fs-extra');
const utils = require('./../utils');
var glob = require('glob-all');
var chalk = require('chalk');
var gulp = require('gulp');
var mocha = require('gulp-mocha');
var gulpCount = require('gulp-count');
var babel = require('babel-register');

class RunTests {
    constructor(Webiny, config) {
        this.Webiny = Webiny;
        this.config = config;
    }

    run() {
        return Promise.all(this.config.apps.map(appObj => {
            return new Promise(resolve => {
                glob(appObj.sourceFolder + '/Tests/*.js', function (er, files) {
                    if (files.length < 1) {
                        return resolve();
                    }

                    return gulp.src(files)
                        .pipe(gulpCount('Running ## test(s) for ' + chalk.magenta(appObj.name)))
                        .pipe(mocha({
                            reporter: 'spec',
                            compilers: {
                                js: babel({
                                    "presets": ["es2015"],
                                    resolveModuleSource: function (source) {
                                        if (source === 'Webiny/TestSuite') {
                                            return utils.projectRoot('Apps/Core/Js/Webiny/Modules/Core/TestLib/TestSuite');
                                        }
                                        return source;
                                    }
                                })
                            }
                        }))
                        .on('end', resolve).on('error', function (e) {
                            utils.failure(e.message);
                        });
                });
            });
        }));
    }
}

module.exports = RunTests;