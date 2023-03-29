'use strict';

import sinon from 'sinon';
import {io} from 'socket.io-client';
import should from 'should';
import log4js from 'log4js';
import Service from '../server.es6';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import * as uuid from 'uuid';

const config = {
  port: 3030,
  db: {
    url: 'mongodb://127.0.0.1:27017/reviewton-tests'
  },
  websocket: {
    // intarvalInSeconds: 0.5
  },
  secret: 'test'
};
const app = new Service();
const userParams = {
  _id: 'u1',
  email: 'another@mail.com',
  login: 'login',
  salt: 'salt',
  hash: 'hash',
  permissions: [
    'create-article',
    'estimate-article',
    'update-article',
    'create-comment',
    'update-comment'
  ],
  reactions: {}
};

describe('ContentSocketService', () => {

  let contentSocketService;
  let client;
  let sandbox;
  let token;

  before(async () => {
    sandbox = sinon.createSandbox();
    sandbox.stub(log4js, 'getLogger').returns({
      error: () => {},
      info: () => {}
    });
    await app.start(config);
    contentSocketService = app._container.resolve('contentSocketService');
    client = io('http://localhost:3030/');
    token = jwt.sign({sub: userParams._id}, config.secret, {expiresIn: '7d'});
  });

  beforeEach(async () => {
    sandbox.useFakeTimers({toFake: ['Date'], now: Date.parse('2022-09-03T16:38:05.447Z')});
    sandbox.stub(contentSocketService, '_getId').returns('id');
    let user = await new mongoose.models['User'](userParams).save();
    let subject = await new mongoose.models['Subject']({ _id: 's1', name: 'Test subject'}).save();
    let tag1 = await new mongoose.models['Tag']({ _id: 't1', name: 'Tag1'}).save();
    let date = Date.now();
    contentSocketService._contexts = {};
    contentSocketService._intervals = {};
    await new mongoose.models['Article'](
      {
        _id: 'a1', 
        rating: 5, text: 'Test 1', createTime: date, user: user._id, subject: subject._id, tags: [tag1._id]}).save();
  });

  afterEach(async () => {
    sandbox.restore();
    client.off('article-update-a1');
    await app._db.clear();
  });

  after(async () => {
    await app._db.clear();
    await app._db.delete();
    client.close();
    sandbox.restore();
    await app.stop();
  });

  it('should subscribe with user', async () => {
    let mock = sandbox.mock();
    mock.once().withArgs({
      _id: 'a1',
      rating: 5,
      text: 'Test 1',
      createTime: '2022-09-03T16:38:05.447Z',
      user: {_id: 'u1', login: 'login'},
      subject: {_id: 's1', name: 'Test subject'},
      tags: [{_id: 't1', name: 'Tag1'}],
      views: 1,
      likes: 0,
      dislikes: 0,
      commentsCount: 0,
      changed: false
    });
    client.on('article-update-a1', mock);
    await new Promise(res => setTimeout(res, 25));
    client.emit('article-feed:subscribe', {data: {article: 'a1', authorization: `Bearer ${token}`}});
    await new Promise(res => setTimeout(res, 250));
    mock.verify();
    contentSocketService._contexts.should.be.eql({[client.id]: {a1: {userId: 'u1', getComments: false}}});
    contentSocketService._intervals.should.be.eql({[client.id]: {a1: [client.id, 'a1']}});
  });

  it('should subscribe without user', async () => {
    client.emit('article-feed:subscribe', {data: {article: 'a1', authorization: 'Bearer '}});
    await new Promise(res => setTimeout(res, 250));
    contentSocketService._contexts.should.be.eql({[client.id]: {a1: {userId: undefined, getComments: false}}});
    contentSocketService._intervals.should.be.eql({[client.id]: {a1: [client.id, 'a1']}});
  });

  it('should unsubscribe indepotent', async () => {
    client.emit('article-feed:unsubscribe', {data: {article: 'a1'}});
    await new Promise(res => setTimeout(res, 25));
    contentSocketService._contexts.should.be.eql({});
    contentSocketService._intervals.should.be.eql({});
  });

  it('should unsubscribe', async () => {
    contentSocketService._contexts = {[client.id]: {a1: {userId: 'u1', getComments: false}}};
    contentSocketService._intervals = {[client.id]: {a1: [client.id, 'a1']}};
    client.emit('article-feed:unsubscribe', {data: {article: 'a1'}});
    await new Promise(res => setTimeout(res, 25));
    contentSocketService._contexts.should.be.eql({[client.id]: {}});
    contentSocketService._intervals.should.be.eql({[client.id]: {}});
  });

  it('should subscribe to comments', async () => {
    contentSocketService._contexts = {[client.id]: {a1: {userId: 'u1', getComments: false}}};
    client.emit('article-feed:subscribe-comments', {data: {article: 'a1'}});
    await new Promise(res => setTimeout(res, 25));
    contentSocketService._contexts.should.be.eql({[client.id]: {a1: {userId: 'u1', getComments: true}}});
  });

  it('should unsubscribe from comments', async () => {
    contentSocketService._contexts = {[client.id]: {a1: {userId: 'u1', getComments: true}}};
    client.emit('article-feed:unsubscribe-comments', {data: {article: 'a1'}});
    await new Promise(res => setTimeout(res, 25));
    contentSocketService._contexts.should.be.eql({[client.id]: {a1: {userId: 'u1', getComments: false}}});
  });

  it('should not estimate article without user', async () => {
    client.emit('article-feed:estimate-article', {data: {article: 'a1', reaction: true}});
    let user = await mongoose.models['User'].findById('u1').lean();
    should(user.reactions).be.eql(undefined);
  });

  it('should estimate article', async () => {
    contentSocketService._contexts = {[client.id]: {a1: {userId: 'u1', getComments: false}}};
    client.emit('article-feed:estimate-article', {data: 
      {article: 'a1', reaction: true, authorization: `Bearer ${token}`}});
    await new Promise(res => setTimeout(res, 250));
    let user = await mongoose.models['User'].findById('u1').lean();
    should(user.reactions).be.eql({a1: true});
  });

  it('should clear user article reaction', async () => {
    await mongoose.models['User'].updateOne({_id: 'u1'}, {reactions: {a1: true}});
    contentSocketService._contexts = {[client.id]: {a1: {userId: 'u1', getComments: false}}};
    client.emit('article-feed:estimate-article', {data: 
      {article: 'a1', reaction: undefined, authorization: `Bearer ${token}`}});
    await new Promise(res => setTimeout(res, 250));
    let user = await mongoose.models['User'].findById('u1').lean();
    should(user.reactions).be.eql({});
  });

  it('should not upsert comment to article without user', async () => {
    client.emit('article-feed:upsert-comment', {data: {article: 'a1', reaction: true}});
    await new Promise(res => setTimeout(res, 250));
    let comments = await mongoose.models['Comment'].find().lean();
    should(comments).be.eql([]);
  });

  it('should upsert comment to article', async () => {
    contentSocketService._contexts = {[client.id]: {a1: {userId: 'u1', getComments: false}}};
    client.emit('article-feed:upsert-comment', {data: {article: 'a1', text: 'Text', authorization: `Bearer ${token}`}});
    await new Promise(res => setTimeout(res, 250));
    let comments = await mongoose.models['Comment'].find().lean();
    should(comments.length).be.eql(1);
    should(comments[0]).be.eql({
      _id: 'id',
      text: 'Text',
      user: 'u1',
      article: 'a1',
      createTime: comments[0].createTime
    });
  });

  it('should disconnect', async () => {
    contentSocketService._contexts = {[client.id]: {a1: {userId: 'u1', getComments: false}}};
    contentSocketService._intervals = {[client.id]: {a1: [client.id, 'a1']}};
    client.disconnect();
    await new Promise(res => setTimeout(res, 250));
    should(contentSocketService._contexts).be.eql({});
    should(contentSocketService._intervals).be.eql({});
  });
});
