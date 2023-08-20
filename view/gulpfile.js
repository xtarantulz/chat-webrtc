const gulp = require("gulp"),
      watch = require('gulp-watch'),
      concat = require("gulp-concat"),

      gzip = require('gulp-gzip');
      babelify = require('babelify'),
      uglify = require('gulp-uglify'),
      browserify = require('browserify'),
      streamify = require('gulp-streamify'),
      source = require('vinyl-source-stream');

gulp.task('apply-prod-environment', function() {
    process.env.NODE_ENV = 'production';
});

gulp.task('productionMode',['apply-prod-environment', 'buildProduction'], function() {});

gulp.task('buildDebug', function () {
    return browserify({entries: './react/main.jsx', extensions: ['.jsx'], debug: true})
        .transform('babelify', {presets: ['es2015', 'react']})
        .bundle()
        .pipe(source('bundle.js'))
        .pipe(gulp.dest('../public/js/'));
});

gulp.task('buildProduction', function () {
    return browserify({entries: './react/main.jsx', extensions: ['.jsx'], debug: true})
        .transform('babelify', {presets: ['es2015', 'react']})
        .bundle()
        .pipe(source('bundle.js'))
        .pipe(streamify(uglify()))
        .pipe(gulp.dest('../public/js/'));
});

gulp.task('watchDebug', ['buildDebug'], function () {
    gulp.watch('./react/**/*.jsx', ['buildDebug']);
});
