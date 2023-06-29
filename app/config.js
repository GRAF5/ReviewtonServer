'use strict';

module.exports = {
  port: 3030,
  db: {
    // url: 'mongodb+srv://graf:72961385Andrei@atlascluster.ahamkqr.mongodb.net/reviewton?retryWrites=true&w=majority'
    url: 'mongodb://127.0.0.1:27017/reviewton'
  },
  websocket: {
    intarvalInSeconds: 10
  },
  // secret: '^bg9y@F^S*3U=aadhf4^!*u4QX5m+QyG^=w+v52cvdy3*^F3DLrNAXJGq8%3Q45mjC$*-',
  secret: 'kxewqwKPtVUd4SGw8EI3b40KGQUag5mZjsaLkNj7TxQt0NtmmpZbY40K6SjzwzQWmpOEY',
  articleImageMaxSize: 512,
  aws: {
    endpoint: 'https://s3.eu-central-003.backblazeb2.com',
    region: 'eu-central-003',
    accessKeyId: '0031d69d4e885e70000000001',
    secretAccessKey: 'K003eRQc/J+9cxJQUhtR8XNVrW9vL44',
    // bucket: 'reviewton',
    bucket: 'reviewton-staging',
    api: 'https://api003.backblazeb2.com/'
  },
  imageCachingTimeInMinutes: 60,
  maxArticleImagesCount: 20,
  maxArticleUniqueImagesCount: 7,
  maxArticleTextLength: 4096,
  maxCommentTextLength: 2048,
  maxSubjectLength: 64,
  maxTagLength: 64
};
