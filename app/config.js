'use strict';

module.exports = {
  port: 3030,
  db: {
    url: 'mongodb://127.0.0.1:27017/reviewton'
  },
  websocket: {
    intarvalInSeconds: 10
  },
  secret: '^bg9y@F^S*3U=aadhf4^!*u4QX5m+QyG^=w+v52cvdy3*^F3DLrNAXJGq8%3Q45mjC$*-',
  articleImageMaxSize: 512,
  aws: {
    region: 'eu-central-1',
    accessKeyId: 'AKIA23G3U4KO427QJ3HM',
    secretAccessKey: '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',
    bucket: 'reviewton-staging'
  },
  imageCachingTimeInMinutes: 60,
  maxArticleImagesCount: 7
};
