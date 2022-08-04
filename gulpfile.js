'use strict';

const gulp = require('gulp');
const util = require('gulp-util');
const gls = require('gulp-live-server');
const eslint = require('gulp-eslint');
const mocha = require('gulp-mocha')({
  timeout: 15000
});

function defaultTask(cb) {
  console.log('Usage: gulp');
  console.log('\tserver - s - run dev server');
  console.log('s - check code style');
  cb();
}
function serverTask(cb) {
  const path = './app/app.js';
  const server = gls.new(path);
  server.start();
  gulp.watch('/**.*.{js,es6}', function(done) {
    server.start();
    done();
  });
  cb();
}

function codeStyle(cb) {
  gulp.src(['**/*.{js,es6}', '!**/public/**', '!**/node_modules/**', '!**/jsdoc/**', '!**/coverage/**', 
    '!**/compiled/**'])
    .pipe(eslint())
    .pipe(eslint.format());
  cb();
}

function unit() {
  process.env.NODE_ENV = 'test';

  const path = `app/**/${util.env.tags || '*.spec.{js,es6}'}`;
  return gulp.src(path, {read: false})
    .pipe(mocha)
    .once('end', exitCode => setTimeout(process.exit.bind(null, exitCode), 1000));
}

exports.default = defaultTask;
exports.server = serverTask;
exports.s = serverTask;
exports.cs = codeStyle;
exports.unit = unit;
