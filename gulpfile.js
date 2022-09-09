'use strict';

const gulp = require('gulp');
const util = require('gulp-util');
const gls = require('gulp-live-server');
const eslint = require('gulp-eslint');
const mocha = require('gulp-mocha')({
  timeout: 15000,
  require: '@babel/register',
  exit: true
});
const cover = require('gulp-spawn-mocha-nyc/lib');

function defaultTask(cb) {
  console.log('Usage: gulp');
  console.log('\tserver - s - run dev server');
  console.log('\tcs - check code style');
  console.log('\tunit - start unit tests, --tags filename to start selected tests');
  cb();
}
function serverTask(cb) {
  const paths = './app/app.js';
  const server = gls.new(paths);
  server.start();
  gulp.watch('/**.*.{js,es6}', function(done) {
    server.start();
    done();
  });
  cb();
}

function codeStyle(cb) {
  gulp.src(['**/*.{js,es6}', '!**/node_modules/**', '!**/coverage/**'])
    .pipe(eslint())
    .pipe(eslint.format())
    .on('data', function(file) {
      if (file.eslint.messages && file.eslint.messages.length) {
        gulp.fail = true;
      }
    });
  cb();
}

function unit() {
  process.env.NODE_ENV = 'test';

  const paths = `app/**/${util.env.tags || '*.spec.{js,es6}'}`;
  return gulp.src(paths, {read: false})
    .pipe(mocha);
}

function coverage() {
  const paths = ['app/**/*.spec.{js,es6}', '!**/node_modules/**', '!**/coverage/**'];
  return gulp.src(paths, {read: false})
    .pipe(cover({
      env: { NODE_ENV: 'test' },
      require: '@babel/register',
      nyc: {
        sourceMap: false,
        instrument: false,
        tempDir: './coverage/.nyc_output',
        extension: ['.js', '.es6'],
        reporter: ['text-summary', 'html'],
        reportDir: './coverage/report'
      },
      timeout: 15000,
      exit: true
    }));
}

exports.default = defaultTask;
exports.server = serverTask;
exports.s = serverTask;
exports.cs = codeStyle;
exports.unit = unit;
exports.coverage = coverage;
