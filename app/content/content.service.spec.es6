'use strict';

import Service from '../server.es6';
import request from 'supertest';
import sinon from 'sinon';
import log4js from 'log4js';
import mongoose from 'mongoose';
import should from 'should';
import jwt from 'jsonwebtoken';
import {mockClient} from 'aws-sdk-client-mock';
import { PutObjectCommand, GetObjectCommand, S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import {sdkStreamMixin} from '@aws-sdk/util-stream-node';
import {Readable} from 'stream';
import fs from 'fs';
import crypto from 'crypto';
import * as fetch from 'node-fetch';
import argon2d from 'argon2';

/**
 * @test ContentService
 */
describe('ContentService', () => {

  const conf = {
    db: {
      url: 'mongodb://127.0.0.1:27017/reviewton-tests'
    },
    aws: {
      accessKeyId: 'accessKeyId',
      secretAccessKey: 'secretAccessKey',
      api: 'https://api/',
      bucket: 'bucket'
    },
    secret: 'test',
    imageCachingTimeInMinutes: 0.5,
    maxArticleImagesCount: 5,
    maxArticleUniqueImagesCount: 3,
    maxArticleTextLength: 4096,
    maxSubjectLength: 64,
    maxTagLength: 64
  };
  const userParams = {
    _id: '1',
    email: 'another@mail.com',
    login: 'login',
    salt: 'salt',
    hash: 'hash',
    permissions: [
      'create-article',
      'update-article',
      'create-comment',
      'update-comment'
    ]
  };
  let app = new Service();
  let server;
  let sandbox;
  let contentService;
  let s3Mock;

  before(async () => {
    sandbox = sinon.createSandbox();
    sandbox.stub(log4js, 'getLogger').returns({
      error: () => {},
      info: () => {}
    });
    await app.start(conf);
    server = app._server;
    contentService = app._container.resolve('contentService');
  });

  beforeEach(() => {
    sandbox.stub(fetch, 'default').resolves({
      json: async () => {
        return {
          authorizationToken: 'authorizationToken',
          allowed: {
            bucketId: 'bucketId'
          }};
      }
    });
    s3Mock = mockClient(S3Client);
    sandbox.useFakeTimers({toFake: ['Date'], now: Date.parse('2022-09-03T16:38:05.447Z')});
  });

  afterEach(async () => {
    s3Mock.restore();
    sandbox.restore();
    await app._db.clear();
  });

  after(async () => {
    await app._db.clear();
    await app._db.delete();
    await app.stop();
    sandbox.restore();
  });

  /**
   * @test ContentService#getArticles
   */
  describe('getArticles', () => {

    it('should get empty array if there no articles', async () => {
      let res = await request(server)
        .get('/content/articles')
        .expect(200);
      res.text.should.be.eql(JSON.stringify({articles: []}));
    });
    
    it('should not get empty articles', async () => {
      let user = await new mongoose.models['User'](userParams).save();
      let subject = await new mongoose.models['Subject']({ _id: '1', name: 'Test subject'}).save();
      let date = Date.now();
      await new mongoose.models['Article'](
        {_id: '1', rating: 5, text: '', createTime: date, user: user._id, subject: subject._id}).save();
      await new mongoose.models['Article'](
        {_id: '2', rating: 5, text: 'Test 2', createTime: date, user: user._id, subject: subject._id}).save();
      let res = await request(server)
        .get('/content/articles')
        .expect(200);
      res.text.should.be.eql(JSON.stringify({articles: [
        {_id: '2', rating: 5, text: 'Test 2', 
          createTime: '2022-09-03T16:38:05.447Z', user: {_id: user._id, login: user.login}, 
          subject: subject, tags:[], views: 0,
          changed: false, commentsCount: 0, likes: 0, dislikes: 0}]}));
    });

    it('should get all articles if name not defined', async () => {
      let user = await new mongoose.models['User'](userParams).save();
      let subject = await new mongoose.models['Subject']({ _id: '1', name: 'Test subject'}).save();
      let date = Date.now();
      await new mongoose.models['Article'](
        {_id: '1', rating: 5, text: 'Test 1', createTime: date, user: user._id, subject: subject._id}).save();
      await new mongoose.models['Article'](
        {_id: '2', rating: 5, text: 'Test 2', createTime: date, user: user._id, subject: subject._id}).save();
      let res = await request(server)
        .get('/content/articles')
        .expect(200);
      res.text.should.be.eql(JSON.stringify({articles: [
        {_id: '1', rating: 5, text: 'Test 1', 
          createTime: '2022-09-03T16:38:05.447Z', user: {_id: user._id, login: user.login}, 
          subject: subject, tags:[], views: 0,
          changed: false, commentsCount: 0, likes: 0, dislikes: 0},
        {_id: '2', rating: 5, text: 'Test 2', 
          createTime: '2022-09-03T16:38:05.447Z', user: {_id: user._id, login: user.login}, 
          subject: subject, tags:[], views: 0,
          changed: false, commentsCount: 0, likes: 0, dislikes: 0}]}));
    });
    
    it('should get articles ordered by create time', async () => {
      let user = await new mongoose.models['User'](userParams).save();
      let subject = await new mongoose.models['Subject']({ _id: '1', name: 'Test subject'}).save();
      let date1 = Date.now() - 2000;
      let date2 = Date.now();
      let date3 = Date.now() - 1000;
      await new mongoose.models['Article'](
        {_id: '1', rating: 5, text: 'Test 1', createTime: date1, user: user._id, subject: subject._id}).save();
      await new mongoose.models['Article'](
        {_id: '2', rating: 5, text: 'Test 2', createTime: date2, user: user._id, subject: subject._id}).save();
      await new mongoose.models['Article'](
        {_id: '3', rating: 5, text: 'Test 3', createTime: date3, user: user._id, subject: subject._id}).save();
      let res = await request(server)
        .get('/content/articles')
        .expect(200);
      res.text.should.be.eql(JSON.stringify({articles: [
        {_id: '2', rating: 5, text: 'Test 2', 
          createTime: '2022-09-03T16:38:05.447Z', user: {_id: user._id, login: user.login}, 
          subject: subject, tags:[], views: 0,
          changed: false, commentsCount: 0, likes: 0, dislikes: 0},
        {_id: '3', rating: 5, text: 'Test 3', 
          createTime: '2022-09-03T16:38:04.447Z', user: {_id: user._id, login: user.login}, 
          subject: subject, tags:[], views: 0,
          changed: false, commentsCount: 0, likes: 0, dislikes: 0},
        {_id: '1', rating: 5, text: 'Test 1', 
          createTime: '2022-09-03T16:38:03.447Z', user: {_id: user._id, login: user.login}, 
          subject: subject, tags:[], views: 0,
          changed: false, commentsCount: 0, likes: 0, dislikes: 0}]}));
    });

    it('should get articles by subjects name', async () => {
      let user = await new mongoose.models['User'](userParams).save();
      let subject1 = await new mongoose.models['Subject']({ _id: '1', name: 'Test subject 1'}).save();
      let subject2 = await new mongoose.models['Subject']({ _id: '2', name: 'Test subject 2'}).save();
      let subject3 = await new mongoose.models['Subject']({ _id: '3', name: 'Subject 3'}).save();
      let date = Date.now();
      await new mongoose.models['Article'](
        {_id: '1', rating: 5, text: 'Test 1', createTime: date, user: user._id, subject: subject1._id}).save();
      await new mongoose.models['Article'](
        {_id: '2', rating: 5, text: 'Test 2', createTime: date, user: user._id, subject: subject2._id}).save();
      await new mongoose.models['Article'](
        {_id: '3', rating: 5, text: 'Test 3', createTime: date, user: user._id, subject: subject3._id}).save();
      let res = await request(server)
        .get('/content/articles')
        .query({filter: 'Test subject'})
        .expect(200);
      res.text.should.be.eql(JSON.stringify({articles: [
        {_id: '1', rating: 5, text: 'Test 1', 
          createTime: '2022-09-03T16:38:05.447Z', user: {_id: user._id, login: user.login}, 
          subject: subject1, tags:[], views: 0,
          changed: false, commentsCount: 0, likes: 0, dislikes: 0},
        {_id: '2', rating: 5, text: 'Test 2', 
          createTime: '2022-09-03T16:38:05.447Z', user: {_id: user._id, login: user.login}, 
          subject: subject2, tags:[], views: 0,
          changed: false, commentsCount: 0, likes: 0, dislikes: 0}]}));
    });

    it('should get articles by tag name', async () => {
      const sub1 = { _id: '1', name: 'Test subject 1'};
      const sub2 = { _id: '2', name: 'Test subject 2'};
      let user = await new mongoose.models['User'](userParams).save();
      let tag1 = await new mongoose.models['Tag']({ _id: '1', name: 'Tag1'}).save();
      let tag2 = await new mongoose.models['Tag']({ _id: '2', name: 'Tag2'}).save();
      let subject1 = await new mongoose.models['Subject'](sub1).save();
      let subject2 = await new mongoose.models['Subject'](sub2).save();
      let date = Date.now();
      await new mongoose.models['Article'](
        {
          _id: '1', rating: 5, text: 'Test 1', 
          createTime: date, user: user._id, subject: subject1._id, tags: [tag1._id]}).save();
      await new mongoose.models['Article'](
        {
          _id: '2', rating: 5, text: 'Test 2', 
          createTime: date, user: user._id, subject: subject2._id, tags: [tag2._id]}).save();
      let res = await request(server)
        .get('/content/articles')
        .query({filter: 'Tag1'})
        .expect(200);
      res.text.should.be.eql(JSON.stringify({articles: [
        {_id: '1', rating: 5, text: 'Test 1', 
          createTime: '2022-09-03T16:38:05.447Z', user: {_id: user._id, login: user.login}, 
          subject: sub1, tags:[tag1], views: 0,
          changed: false, commentsCount: 0, likes: 0, dislikes: 0}]}));
    });

    it('should get articles by user login', async () => {
      const sub1 = { _id: '1', name: 'Test subject 1'};
      const sub2 = { _id: '2', name: 'Test subject 2'};
      let user1 = await new mongoose.models['User']({...userParams, login: 'login1'}).save();
      let user2 = await new mongoose.models['User']({...userParams, login: 'login2', _id: '2'}).save();
      let subject1 = await new mongoose.models['Subject'](sub1).save();
      let subject2 = await new mongoose.models['Subject'](sub2).save();
      let date = Date.now();
      await new mongoose.models['Article'](
        {_id: '1', rating: 5, text: 'Test 1', createTime: date, user: user1._id, subject: subject1._id}).save();
      await new mongoose.models['Article'](
        {_id: '2', rating: 5, text: 'Test 2', createTime: date, user: user2._id, subject: subject2._id}).save();
      let res = await request(server)
        .get('/content/articles')
        .query({filter: 'login1'})
        .expect(200);
      res.text.should.be.eql(JSON.stringify({articles: [
        {_id: '1', rating: 5, text: 'Test 1', 
          createTime: '2022-09-03T16:38:05.447Z', user: {_id: user1._id, login: user1.login}, 
          subject: sub1, tags:[], views: 0,
          changed: false, commentsCount: 0, likes: 0, dislikes: 0}]}));
    });
  });

  /**
   * @test ContentService#getArticlesByUserId
   */
  describe('getArticlesByUserId', () => {

    it('should get empty array if there no articles', async () => {
      let res = await request(server)
        .get('/content/articles/user/1')
        .expect(200);
      res.text.should.be.eql(JSON.stringify({articles: []}));
    });

    it('should get all user articles', async () => {
      let user = await new mongoose.models['User'](userParams).save();
      let subject = await new mongoose.models['Subject']({ _id: '1', name: 'Test subject'}).save();
      let date = Date.now();
      await new mongoose.models['Article'](
        {_id: '1', rating: 5, text: '', createTime: date, user: user._id, subject: subject._id}).save();
      await new mongoose.models['Article'](
        {_id: '2', rating: 5, text: 'Test 2', createTime: date, user: user._id, subject: subject._id}).save();
      await new mongoose.models['Article'](
        {_id: '3', rating: 5, text: 'Test 3', createTime: date, user: '2', subject: subject._id}).save();
      let res = await request(server)
        .get('/content/articles/user/1')
        .expect(200);
      res.text.should.be.eql(JSON.stringify({articles: [
        {_id: '1', rating: 5, text: '', 
          createTime: '2022-09-03T16:38:05.447Z', user: {_id: user._id, login: user.login}, 
          subject: subject, tags:[], views: 0,
          changed: false, commentsCount: 0, likes: 0, dislikes: 0},
        {_id: '2', rating: 5, text: 'Test 2', 
          createTime: '2022-09-03T16:38:05.447Z', user: {_id: user._id, login: user.login}, 
          subject: subject, tags:[], views: 0,
          changed: false, commentsCount: 0, likes: 0, dislikes: 0}]}));
    });
  });

  /**
   * @test ContentService#getArticlesBySubjectId
   */
  describe('getArticlesBySubjectId', () => {

    it('should get empty array if there no articles', async () => {
      let res = await request(server)
        .get('/content/articles/subject/1')
        .expect(200);
      res.text.should.be.eql(JSON.stringify({articles: []}));
    });

    it('should get all subject articles', async () => {
      let user = await new mongoose.models['User'](userParams).save();
      let user2 = await new mongoose.models['User']({...userParams, _id: '2'}).save();
      let subject = await new mongoose.models['Subject']({ _id: '1', name: 'Test subject'}).save();
      let date = Date.now();
      await new mongoose.models['Article'](
        {_id: '1', rating: 5, text: '', createTime: date, user: user._id, subject: subject._id}).save();
      await new mongoose.models['Article'](
        {_id: '2', rating: 5, text: 'Test 2', createTime: date, user: user._id, subject: 2}).save();
      await new mongoose.models['Article'](
        {_id: '3', rating: 5, text: 'Test 3', createTime: date, user: user2._id, subject: subject._id}).save();
      let res = await request(server)
        .get('/content/articles/subject/1')
        .expect(200);
      res.text.should.be.eql(JSON.stringify({articles: [
        {_id: '1', rating: 5, text: '', 
          createTime: '2022-09-03T16:38:05.447Z', user: {_id: user._id, login: user.login}, 
          subject: subject, tags:[], views: 0,
          changed: false, commentsCount: 0, likes: 0, dislikes: 0},
        {_id: '3', rating: 5, text: 'Test 3', 
          createTime: '2022-09-03T16:38:05.447Z', user: {_id: user2._id, login: user.login}, 
          subject: subject, tags:[], views: 0,
          changed: false, commentsCount: 0, likes: 0, dislikes: 0}]}));
    });
  });

  /**
   * @test ContentService#getArticlesByTagId
   */
  describe('getArticlesByTagId', () => {

    it('should get empty array if there no articles', async () => {
      let res = await request(server)
        .get('/content/articles/tag/1')
        .expect(200);
      res.text.should.be.eql(JSON.stringify({articles: []}));
    });

    it('should get all subject articles', async () => {
      let user = await new mongoose.models['User'](userParams).save();
      let user2 = await new mongoose.models['User']({...userParams, _id: '2'}).save();
      let subject = await new mongoose.models['Subject']({ _id: '1', name: 'Test subject'}).save();
      let tag = await new mongoose.models['Tag']({_id: '1', name: 'Tag1'}).save();
      let tag2 = await new mongoose.models['Tag']({_id: '2', name: 'Tag2'}).save();
      let date = Date.now();
      await new mongoose.models['Article'](
        {_id: '1', rating: 5, text: '', tags: ['1'], createTime: date, user: user._id, subject: subject._id}).save();
      await new mongoose.models['Article'](
        {_id: '2', rating: 5, text: 'Test 2', tags: ['2'], createTime: date, user: user2._id, subject: 2}).save();
      await new mongoose.models['Article'](
        {_id: '3', rating: 5, text: 'Test 3', tags: [], createTime: date, user: user._id, subject: subject._id}).save();
      let res = await request(server)
        .get('/content/articles/tag/1')
        .expect(200);
      res.text.should.be.eql(JSON.stringify({articles: [
        {_id: '1', rating: 5, text: '', 
          createTime: '2022-09-03T16:38:05.447Z', user: {_id: user._id, login: user.login}, 
          subject: subject, tags:[{_id: '1', name: 'Tag1'}], views: 0,
          changed: false, commentsCount: 0, likes: 0, dislikes: 0}]}));
    });
  });

  /**
   * @test ContentService#getTags
   */
  describe('getTags', () =>{
    it('should get empty array if there no tags', async () => {
      let res = await request(server)
        .get('/content/tags')
        .expect(200);
      res.text.should.be.eql(JSON.stringify({tags: []}));
    });
    
    it('should get all tags if filter not defined', async () => {
      let tag1 = await new mongoose.models['Tag']({ _id: '1', name: 'Tag1'}).save();
      let tag2 = await new mongoose.models['Tag']({ _id: '2', name: 'Tag2'}).save();
      let date = Date.now() - 2000;
      let user = await new mongoose.models['User'](userParams).save();
      let subject = await new mongoose.models['Subject']({ _id: '1', name: 'Test subject'}).save();
      let article1 = await new mongoose.models['Article'](
        {
          _id: '1', rating: 5, text: 'Test 1', 
          createTime: date, user: user._id, subject: subject._id, tags:[tag1._id, tag2._id]}).save();
      let article2 = await new mongoose.models['Article'](
        {
          _id: '2', rating: 5, text: 'Test 2', 
          createTime: date, user: user._id, subject: subject._id, tags:[tag2._id]}).save();
      let res = await request(server)
        .get('/content/tags')
        .expect(200);
      res.text.should.be.eql(JSON.stringify({tags: [
        {_id: '2', name: 'Tag2', subscribers: 0, articleCount: 2},
        {_id: '1', name: 'Tag1', subscribers: 0, articleCount: 1}
      ]}));
    });

    
    it('should get tags ordered by articles count', async () => {
      let user = await new mongoose.models['User'](userParams).save();
      let tag1 = await new mongoose.models['Tag']({ _id: '1', name: 'Tag1'}).save();
      let tag2 = await new mongoose.models['Tag']({ _id: '2', name: 'Tag2'}).save();
      let tag3 = await new mongoose.models['Tag']({ _id: '3', name: 'Tag3'}).save();
      let subject = await new mongoose.models['Subject']({ _id: '1', name: 'Test subject'}).save();
      let date = Date.now() - 2000;
      let article1 = await new mongoose.models['Article'](
        {
          _id: '1', rating: 5, text: 'Test 1', 
          createTime: date, user: user._id, subject: subject._id, tags:[tag1._id, tag2._id, tag3._id]}).save();
      let article2 = await new mongoose.models['Article'](
        {
          _id: '2', rating: 5, text: 'Test 2', 
          createTime: date, user: user._id, subject: subject._id, tags:[tag2._id, tag3._id]}).save();
      let article3 = await new mongoose.models['Article'](
        {
          _id: '3', rating: 5, text: 'Test 3', 
          createTime: date, user: user._id, subject: subject._id, tags:[tag2._id]}).save();
      let res = await request(server)
        .get('/content/tags')
        .expect(200);
      res.text.should.be.eql(JSON.stringify({tags: [
        { _id: '2', name: 'Tag2', subscribers: 0, articleCount: 3},
        { _id: '3', name: 'Tag3', subscribers: 0, articleCount: 2},
        { _id: '1', name: 'Tag1', subscribers: 0, articleCount: 1}]}));
    });
    
    it('should get tags by filter', async () => {
      let tag1 = await new mongoose.models['Tag']({ _id: '1', name: 'Tag1'}).save();
      let tag2 = await new mongoose.models['Tag']({ _id: '2', name: 'Tag2'}).save();
      let date = Date.now() - 2000;
      let user = await new mongoose.models['User'](userParams).save();
      let subject = await new mongoose.models['Subject']({ _id: '1', name: 'Test subject'}).save();
      let article1 = await new mongoose.models['Article'](
        {
          _id: '1', rating: 5, text: 'Test 1', 
          createTime: date, user: user._id, subject: subject._id, tags:[tag1._id, tag2._id]}).save();
      let article2 = await new mongoose.models['Article'](
        {
          _id: '2', rating: 5, text: 'Test 2', 
          createTime: date, user: user._id, subject: subject._id, tags:[tag2._id]}).save();
      let res = await request(server)
        .get('/content/tags')
        .query({filter: '1'})
        .expect(200);
      res.text.should.be.eql(JSON.stringify({tags: [
        {_id: '1', name: 'Tag1', subscribers: 0, articleCount: 1}
      ]}));
    });
  });

  /**
   * @test ContentService#createArticle
   */
  describe('createArticle', () => {

    let articleParam;
    let token;
    const user = {
      _id: '1',
      email: 'test@test.com',
      login: 'login',
      permissions: [
        'create-article',
        'update-article',
        'create-comment',
        'update-comment'
      ],
      salt: 'e2996430759b75a241dcdc846605c227',
      // eslint-disable-next-line max-len
      hash: '2ef725a0fb2fcda3d8632c5a110625c8c70de406bfcfeceb2225ea47973e301480f76ea460c67490c89b2624e3cb16608fdc86321b0188cc43572cf65e28e310'
      //password: 'QwerTY123456'
    };

    beforeEach(async () => {
      await mongoose.models['User'].create(user);
      articleParam = {
        subject: 'Subject',
        rating: 3
      };
      token = jwt.sign({sub: user._id, token: await argon2d.hash(`${user.login}${user.hash}`)},
        conf.secret, {expiresIn: '7d'});
    });

    it('should return user validation error when subject is undefined', async () => {
      delete articleParam.subject;
      await request(server)
        .post('/content/articles')
        .send(articleParam)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should return user validation error when rating is undefined', async () => {
      delete articleParam.rating;
      await request(server)
        .post('/content/articles')
        .send(articleParam)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should return user validation error when rating over max', async () => {
      articleParam.rating = 10;
      await request(server)
        .post('/content/articles')
        .send(articleParam)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should return user validation error when rating less then min', async () => {
      articleParam.rating = 0;
      await request(server)
        .post('/content/articles')
        .send(articleParam)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should return validation error if user already have article on selected subject', async () => {
      await mongoose.models['Subject'].create({_id: '1', name: articleParam.subject});
      await mongoose.models['Article'].create({rating: 1, 
        subject:'1', _id: '1', user: user._id, createTime: Date.now()});
      await request(server)
        .post('/content/articles')
        .send(articleParam)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });
    
    it('should return validation error if text is not valid html', async () => {
      await request(server)
        .post('/content/articles')
        .send({...articleParam, text: '<img<>'})
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should return validation error if article have many images', async () => {
      let img = fs.readFileSync('app/content/test/image.png');
      let img2 = fs.readFileSync('app/content/test/image2.png');
      let img3 = fs.readFileSync('app/content/test/image3.png');
      let img4 = fs.readFileSync('app/content/test/image4.png');
      await request(server)
        .post('/content/articles')
        .send({...articleParam, 
          text: `<img src="data:image/png;base64,${img.toString('base64')}">` +
          `<img src="data:image/png;base64,${img2.toString('base64')}">` +
          `<img src="data:image/png;base64,${img3.toString('base64')}">` +
          `<img src="data:image/png;base64,${img4.toString('base64')}">`})
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should create article', async () => {
      let res = await request(server)
        .post('/content/articles')
        .send(articleParam)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      let article = await mongoose.models['Article'].findById(res.body._id).lean();
      article.should.be.eql({
        _id: res.body._id,
        createTime: article.createTime,
        rating: articleParam.rating,
        subject: article.subject,
        images: {},
        tags: [],
        views: 0,
        user: user._id,
        changed: false
      });
      Date(article.createTime).should.be.eql(Date(Date.now()));
      let subject = await mongoose.models['Subject'].findById(article.subject).lean();
      subject.name.should.be.eql(articleParam.subject);
      subject.rating.should.be.eql(articleParam.rating);
    });

    it('should create article with images', async () => {
      sandbox.stub(contentService, 'getId').returns('id');
      s3Mock.on(PutObjectCommand).resolves({UploadId: '1'}); 
      let image = fs.readFileSync('app/content/test/image.png');
      const hashSum = crypto.createHash('sha256');
      hashSum.update(image);
      
      const hex = hashSum.digest('hex');
      let res = await request(server)
        .post('/content/articles')
        .send({...articleParam, 
          text: `<img src="data:image/png;base64,${image.toString('base64')}" alt="">` +
          `<img src="data:image/png;base64,${image.toString('base64')}" alt="">`})
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      let article = await mongoose.models['Article'].findById(res.body._id).lean();
      article.should.be.eql({
        _id: res.body._id,
        createTime: article.createTime,
        rating: articleParam.rating,
        subject: article.subject,
        images: {[hex]: `${user._id}/articles/id/${hex}.png`},
        tags: [],
        views: 0,
        user: user._id,
        text: `<img src=${hex}><img src=${hex}>`,
        changed: false
      });
      Date(article.createTime).should.be.eql(Date(Date.now()));
      let subject = await mongoose.models['Subject'].findById(article.subject).lean();
      subject.name.should.be.eql(articleParam.subject);
      subject.rating.should.be.eql(articleParam.rating);
      should(s3Mock.calls().length).be.eql(1);
    });

    it('should create article with tags', async () => {
      articleParam.tags = ['Tag1', 'Tag2'];
      let res = await request(server)
        .post('/content/articles')
        .send(articleParam)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      let article = await mongoose.models['Article'].findById(res.body._id).lean();
      article.rating.should.be.eql(articleParam.rating);
      article.user.should.be.eql(user._id);
      article.tags.length.should.be.eql(2);
      Date(article.createTime).should.be.eql(Date(Date.now()));
      let subject = await mongoose.models['Subject'].findById(article.subject).lean();
      subject.name.should.be.eql(articleParam.subject);
      subject.rating.should.be.eql(articleParam.rating);
    });

    it('should create article and update already created subject and tags', async () => {
      articleParam.tags = ['   Tag1   '];
      articleParam.subject = '  Subject  ';
      let sub = await new mongoose.models['Subject']({ _id: '1', name: 'Subject', rating: 4}).save();
      let tag = await new mongoose.models['Tag']({ _id: '1', name: 'Tag1'}).save();
      let art = await new mongoose.models['Article'](
        {
          _id: '1', rating: 4, text: 'Test 1', 
          createTime: Date.now(), user: '2', subject: sub._id, tags: [tag._id]}).save();
      let res = await request(server)
        .post('/content/articles')
        .send(articleParam)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      let article = await mongoose.models['Article'].findById(res.body._id).lean();
      article.rating.should.be.eql(articleParam.rating);
      article.user.should.be.eql(user._id);
      article.subject.should.be.eql(sub._id);
      article.tags.should.be.eql([tag._id]);
      let subUp = await mongoose.models['Subject'].findById(sub._id).lean();
      subUp.rating.should.be.eql(3.5);
    });
  });

  /**
   * @test ContentService#updateArticle
   */
  describe('updateArticle', () => {
    
    let token;
    const user = {
      _id: '1',
      email: 'test@test.com',
      login: 'login',
      permissions: [
        'create-article',
        'update-article',
        'create-comment',
        'update-comment'
      ],
      salt: 'e2996430759b75a241dcdc846605c227',
      // eslint-disable-next-line max-len
      hash: '2ef725a0fb2fcda3d8632c5a110625c8c70de406bfcfeceb2225ea47973e301480f76ea460c67490c89b2624e3cb16608fdc86321b0188cc43572cf65e28e310'
      //password: 'QwerTY123456'
    };
    const subject = {
      _id: '1',
      rating: 2.5,
      name: 'Subject'
    };
    const article = {
      _id: '1',
      user: user._id,
      subject: subject._id,
      rating: 3,
      text: 'Text',
      createTime: Date.now()
    };

    beforeEach(async () => {
      await mongoose.models['User'].create(user);
      await mongoose.models['Subject'].create(subject);
      await mongoose.models['Article'].create(article);
      await mongoose.models['Article'].create({...article, _id: '12', user: '2', rating: 2});
      token = jwt.sign({sub: user._id, token: await argon2d.hash(`${user.login}${user.hash}`)},
        conf.secret, {expiresIn: '7d'});
    });

    it('should return UnauthorizedError if auth wrong user', async () => {
      let wrongToken = jwt.sign({sub: '2', token: await argon2d.hash(`${user.login}${user.hash}`)}, 
        conf.secret, {expiresIn: '7d'});
      await mongoose.models['User'].create({...user, _id: '2'});
      await request(server)
        .put('/content/articles/1')
        .send({
          subject: subject.name,
          rating: 3
        })
        .set('Authorization', `Bearer ${wrongToken}`)
        .expect(401);
    });

    it('should return article not found error when defined wrong id', async () => {
      await request(server)
        .put('/content/articles/2')
        .send({
          subject: subject.name,
          rating: 3})
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('should return rating validation error when rating over max', async () => {
      await request(server)
        .put('/content/articles/1')
        .send({
          subject: subject.name,
          rating: 6
        })
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should return rating validation error when rating less then min', async () => {
      await request(server)
        .put('/content/articles/1')
        .send({
          subject: subject.name,
          rating: 0
        })
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should return validation error if user already have article on selected subject', async () => {
      await mongoose.models['Article'].create({rating: 1, 
        subject: subject._id, _id: '2', user: user._id, createTime: Date.now()});
      await request(server)
        .put('/content/articles/1')
        .send({...article, subject: subject.name})
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should return validation error if text is not valid html', async () => {
      await request(server)
        .put('/content/articles/1')
        .send({...article, subject: subject.name, text: '<img<>'})
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should return validation error if article have many images', async () => {
      let img = fs.readFileSync('app/content/test/image.png');
      let img2 = fs.readFileSync('app/content/test/image2.png');
      let img3 = fs.readFileSync('app/content/test/image3.png');
      let img4 = fs.readFileSync('app/content/test/image4.png');
      await request(server)
        .put('/content/articles/1')
        .send({...article, subject: subject.name, 
          text: `<img src="data:image/png;base64,${img.toString('base64')}">` +
          `<img src="data:image/png;base64,${img2.toString('base64')}">` +
          `<img src="data:image/png;base64,${img3.toString('base64')}">` +
          `<img src="data:image/png;base64,${img4.toString('base64')}">`})
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should update article old subject', async () => {
      await mongoose.models['Subject'].create({...subject, name: 'Old', _id: '2'});
      await mongoose.models['Article'].create({...article, subject: '2', _id: 2});
      sandbox.stub(contentService, 'getId').returns('id');
      await request(server)
        .put('/content/articles/2')
        .send({
          subject: 'Old new',
          rating: 5,
          text: '<p>text</p>'
        })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      let art = await mongoose.models['Article'].findById('2').lean();
      let oldSub = await mongoose.models['Subject'].findById('2').lean();
      art.subject.should.be.eql('id');
      should(oldSub).null();
    });

    it('should remove article old subject', async () => {
      sandbox.stub(contentService, 'getId').returns('id');
      await request(server)
        .put('/content/articles/1')
        .send({
          subject: subject.name + ' new',
          rating: 5,
          text: 'text'
        })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      let art = await mongoose.models['Article'].findById(article._id).lean();
      let oldSub = await mongoose.models['Subject'].findById(subject._id).lean();
      art.subject.should.be.eql('id');
      should(oldSub.rating).be.eql(2);
    });

    it('should remove old article images', async () => {
      let newImage = fs.readFileSync('app/content/test/image.png');
      const newHashSum = crypto.createHash('sha256');
      newHashSum.update(newImage);
      const newHex = newHashSum.digest('hex');
      let oldImage = fs.readFileSync('app/content/test/oldImage.png');
      const oldHashSum = crypto.createHash('sha256');
      oldHashSum.update(oldImage);
      const oldHex = oldHashSum.digest('hex');
      s3Mock.on(PutObjectCommand).resolves({UploadId: '1'}); 
      await mongoose.models['Subject'].create({...subject, name: 'Old', _id: '2'});
      await mongoose.models['Article'].create({
        ...article, 
        subject: '2', 
        _id: 2,
        images: {[oldHex]: `${user._id}/articles/2/${oldHex}.png`}
      });
      await request(server)
        .put('/content/articles/2')
        .send({
          subject: subject.name + ' new',
          rating: 5,
          text: `<img src="data:image/png;base64,${newImage.toString('base64')}">`
        })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);      
      should(s3Mock.commandCalls(PutObjectCommand, {
        Bucket: conf.aws.bucket,
        Key: `${user._id}/articles/2/${newHex}.png`
      }).length).eql(1);
      should(s3Mock.commandCalls(DeleteObjectCommand, {
        Bucket: conf.aws.bucket,
        Key: `${user._id}/articles/2/${oldHex}.png`
      }).length).eql(1);
    });

    it('should update article text', async () => {
      await request(server)
        .put('/content/articles/1')
        .send({
          subject: subject.name,
          rating: 3,
          text: 'Another text'
        })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      let art = await mongoose.models['Article'].findById(article._id).lean();
      art.text.should.be.eql('Another text');
    });

    it('should update article rating', async () => {
      await request(server)
        .put('/content/articles/1')
        .send({
          subject: subject.name,
          rating: 5
        })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      let art = await mongoose.models['Article'].findById(article._id).lean();
      art.rating.should.be.eql(5);
      let sub = await mongoose.models['Subject'].findById(article.subject).lean();
      sub.rating.should.be.eql(3.5);
    });
  });

  /**
   * @test ContentService#getArticleById
   */
  describe('getArticleById', () => {

    it('should return not found if no article', async () => {
      let res = await request(server)
        .get('/content/articles/1')
        .expect(404);
    });

    it('should get article by id', async () => {
      let user = await new mongoose.models['User'](userParams).save();
      let subject = await new mongoose.models['Subject']({ _id: '1', name: 'Test subject'}).save();
      let date = Date.now();
      await new mongoose.models['Article'](
        {_id: '1', rating: 5, text: '', createTime: date, user: user._id, subject: subject._id}).save();
      await new mongoose.models['Article'](
        {_id: '2', rating: 5, text: 'Test 2', createTime: date, user: user._id, subject: subject._id}).save();
      await new mongoose.models['Article'](
        {_id: '3', rating: 5, text: 'Test 3', createTime: date, user: user._id, subject: subject._id}).save();
      let res = await request(server)
        .get('/content/articles/1')
        .expect(200);
      res.text.should.be.eql(JSON.stringify(
        {_id: '1', rating: 5, text: '', 
          createTime: '2022-09-03T16:38:05.447Z', user: {_id: user._id, login: user.login}, 
          subject: subject, tags: [], views: 0,
          changed: false, commentsCount: 0, likes: 0, dislikes: 0}));
    });
  });

  /**
   * @test ContentService#getTagById
   */
  describe('getTagById', () => {

    it('should return not found if no tag', async () => {
      let res = await request(server)
        .get('/content/tags/1')
        .expect(404);
    });

    it('should get tag by id', async () => {
      let tag = await new mongoose.models['Tag']({_id: '1', name: 'Tag1'}).save();
      let tag2 = await new mongoose.models['Tag']({_id: '2', name: 'Tag2'}).save();
      let res = await request(server)
        .get('/content/tags/1')
        .expect(200);
      res.text.should.be.eql(JSON.stringify(
        {_id: '1', name: 'Tag1', subscribers: 0, articleCount: 0}));
    });
  });

  /**
   * @test ContentService#getSubjectById
   */
  describe('getSubjectById', () => {

    it('should return not found if no subject', async () => {
      let res = await request(server)
        .get('/content/subjects/1')
        .expect(404);
    });

    it('should get tag by id', async () => {
      let subject = await new mongoose.models['Subject']({ _id: '1', name: 'Test subject'}).save();
      let subject2 = await new mongoose.models['Subject']({ _id: '2', name: 'Test subject 2'}).save();
      let res = await request(server)
        .get('/content/subjects/1')
        .expect(200);
      res.text.should.be.eql(JSON.stringify(
        {_id: '1', name: 'Test subject', subscribers: 0, articleCount: 0}));
    });
  });
  
  /**
   * @test ContentService#getSubjects
   */
  describe('getSubjects', () =>{
    it('should get empty array if there no subjects', async () => {
      let res = await request(server)
        .get('/content/subjects')
        .expect(200);
      res.text.should.be.eql(JSON.stringify({subjects: []}));
    });
    
    it('should get all subjects if filter not defined', async () => {
      let subject = await new mongoose.models['Subject']({ _id: '1', name: 'Test subject'}).save();
      let subject2 = await new mongoose.models['Subject']({ _id: '2', name: 'Test subject 2'}).save();
      let date = Date.now() - 2000;
      let user = await new mongoose.models['User'](userParams).save();
      let article1 = await new mongoose.models['Article'](
        {
          _id: '1', rating: 5, text: 'Test 1', 
          createTime: date, user: user._id, subject: subject._id}).save();
      let article2 = await new mongoose.models['Article'](
        {
          _id: '2', rating: 5, text: 'Test 2', 
          createTime: date, user: user._id, subject: subject2._id}).save();
      let article3 = await new mongoose.models['Article'](
        {
          _id: '3', rating: 5, text: 'Test 2', 
          createTime: date, user: user._id, subject: subject2._id}).save();
      let res = await request(server)
        .get('/content/subjects')
        .expect(200);
      res.text.should.be.eql(JSON.stringify({subjects: [
        {_id: '2', name: 'Test subject 2', subscribers: 0, articleCount: 2},
        {_id: '1', name: 'Test subject', subscribers: 0, articleCount: 1}
      ]}));
    });
    
    it('should get subjects by filter', async () => {
      let date = Date.now() - 2000;
      let user = await new mongoose.models['User'](userParams).save();
      let subject = await new mongoose.models['Subject']({ _id: '1', name: 'Test subject 1'}).save();
      let subject1 = await new mongoose.models['Subject']({ _id: '2', name: 'Test subject 2'}).save();
      let article1 = await new mongoose.models['Article'](
        {
          _id: '1', rating: 5, text: 'Test 1', 
          createTime: date, user: user._id, subject: subject._id}).save();
      let article2 = await new mongoose.models['Article'](
        {
          _id: '2', rating: 5, text: 'Test 2', 
          createTime: date, user: user._id, subject: subject1._id}).save();
      let res = await request(server)
        .get('/content/subjects')
        .query({filter: '1'})
        .expect(200);
      res.text.should.be.eql(JSON.stringify({subjects: [
        {_id: '1', name: 'Test subject 1', subscribers: 0, articleCount: 1}
      ]}));
    });
  });

  /**
   * @test ContentService#getFilters
   */
  describe('getFilters', () => {

    it('should return unique and case insensitive filters', async () => {
      let subject = await new mongoose.models['Subject']({ _id: '1', name: 'Filter'}).save();
      let subject3 = await new mongoose.models['Subject']({ _id: '3', name: 'fil'}).save();
      let subject2 = await new mongoose.models['Subject']({ _id: '2', name: 'Wrong'}).save();
      let user = await new mongoose.models['User']({...userParams, login: 'fil'}).save();
      let user1 = await new mongoose.models['User']({...userParams, _id: '2', login: 'wrong'}).save();
      let tag = await new mongoose.models['Tag']({ _id: '1', name: 'fILlter'}).save();
      let tag2 = await new mongoose.models['Tag']({ _id: '2', name: 'wrong'}).save();
      let res = await request(server)
        .get('/content/filters/fil')
        .expect(200);
      should(res.body).be.eql({filters: [
        'fil', 'Filter', 'fILlter'
      ]});
    });
  });

  /**
   * @test ContentService#_articleSetData
   */
  describe('_articleSetData', () => {

    it('should set article data', async () => {
      let user = await new mongoose.models['User']({...userParams, reactions: {'1': true}}).save();
      let data = {
        _id: '1'
      };
      let article = await contentService._articleSetData(data, {locals:{user: {_id: '1'}}});
      should(article).be.eql({
        _id: '1',
        likes: 1,
        dislikes: 0,
        userReaction: true
      });
    });

    it('should get article image from s3', async () => {
      let data = {
        _id: '1',
        images: {'hash': 's3key.png'},
        text: '<img src=hash>',
        user: {
          _id: 'u_id'
        },
        subject: {
          name: 'subject'
        }
      };
      let article = await contentService._articleSetData(data, {});
      should(article).be.eql({
        _id: '1',
        likes: 0,
        dislikes: 0,
        user: {
          _id: 'u_id'
        },
        subject: {
          name: 'subject'
        },
        text: `<img itemprop="image" src="${conf.aws.api}file/${conf.aws.bucket}/s3key.png" ` +
          `alt="${article.subject.name}">`
      });
    });
  });
  
  /**
   * @test ContentService#_checkPagination
   */
  describe('_checkPagination', () => {

    it('should use default values if not defined', () => {
      const req = {
        query: {}
      };
      const {limit, offset} = contentService._checkPagination(req);
      limit.should.be.eql(25);
      offset.should.be.eql(0);
    });

    it('should not go beyond the minimal limit', () => {
      const req = {
        query: {
          limit: -20,
          offset: -20
        }
      };
      const {limit, offset} = contentService._checkPagination(req);
      limit.should.be.eql(1);
      offset.should.be.eql(0);
    });

    it('should not go beyond the maximum limit', () => {
      const req = {
        query: {
          limit: 1000,
          offset: 1000
        }
      };
      const {limit, offset} = contentService._checkPagination(req);
      limit.should.be.eql(25);
      offset.should.be.eql(1000);
    });
  });  
});
