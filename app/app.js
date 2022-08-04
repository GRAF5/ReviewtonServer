'use strict';

require('@babel/register')({
  ignore: [/node_modules(\/|\\)/],
  retainLines: true
});

require('./start.es6');
