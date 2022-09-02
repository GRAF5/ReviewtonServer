'use strict';

import Service from '../server.es6';
import request from 'supertest-promised';
import sinon from 'sinon';
import log4js from 'log4js';
import mongoose from 'mongoose';
import should from 'should';

/**
 * @test ContentService
 */
describe('ContentService', () => {

  const conf = {
    db: {
      url: 'mongodb://127.0.0.1:27017/reviewton-tests'
    },
    secret: 'test'
  };
  const userParams = {
    _id: '1',
    email: 'another@mail.com',
    login: 'login',
    salt: 'salt',
    hash: 'hash'
  };
  let app;
  let server;
  let sandbox;

  before(async () => {
    sandbox = sinon.createSandbox();
    sandbox.stub(log4js, 'getLogger').returns({
      error: () => {},
      info: () => {}
    });
    app = new Service();
    await app.start(conf);
    server = app._server;
    sandbox.useFakeTimers({toFake: ['Date'], now: Date.parse('2022-09-03T16:38:05.447Z')});
  });

  afterEach(async () => {
    await app._db.clear();
  });

  after(async () => {
    await app.stop();
    await app._db.clear();
    await app._db.delete();
    sandbox.restore();
  });

  /**
   * @test ContentService#getArticles
   */
  describe('getArticles', () => {

    it('should get empty array if there not articles', async () => {
      let res = await request(server)
        .get('/content/articles')
        .expect(200)
        .end();
      res.text.should.be.eql(JSON.stringify({articles: []}));
    });

    it('should get all articles if name not defined', async () => {
      let user = await new mongoose.models['User'](userParams).save();
      let subject = await new mongoose.models['Subject']({ _id: '1', name: 'Test subject'}).save();
      let date = Date.now();
      await new mongoose.models['Article']({_id: '1', rating: 5, text: 'Test 1', createTime: date, user: user._id, subject: subject._id}).save();
      await new mongoose.models['Article']({_id: '2', rating: 5, text: 'Test 2', createTime: date, user: user._id, subject: subject._id}).save();
      let res = await request(server)
        .get('/content/articles')
        .expect(200)
        .end();
        res.text.should.be.eql(JSON.stringify({articles: [{_id: '1', rating: 5, text: 'Test 1', createTime: '2022-09-03T16:38:05.447Z', user: user._id, subject: subject._id, __v: 0},
          {_id: '2', rating: 5, text: 'Test 2', createTime: '2022-09-03T16:38:05.447Z', user: user._id, subject: subject._id, __v: 0}]}));
    });
    
    it('should get articles ordered by create time', async () => {
      let user = await new mongoose.models['User'](userParams).save();
      let subject = await new mongoose.models['Subject']({ _id: '1', name: 'Test subject'}).save();
      let date1 = Date.now() - 2000;
      let date2 = Date.now();
      let date3 = Date.now() - 1000;
      await new mongoose.models['Article']({_id: '1', rating: 5, text: 'Test 1', createTime: date1, user: user._id, subject: subject._id}).save();
      await new mongoose.models['Article']({_id: '2', rating: 5, text: 'Test 2', createTime: date2, user: user._id, subject: subject._id}).save();
      await new mongoose.models['Article']({_id: '3', rating: 5, text: 'Test 3', createTime: date3, user: user._id, subject: subject._id}).save();
      let res = await request(server)
        .get('/content/articles')
        .expect(200)
        .end();
        res.text.should.be.eql(JSON.stringify({articles: [
          {_id: '2', rating: 5, text: 'Test 2', createTime: '2022-09-03T16:38:05.447Z', user: user._id, subject: subject._id, __v: 0},
          {_id: '3', rating: 5, text: 'Test 3', createTime: '2022-09-03T16:38:04.447Z', user: user._id, subject: subject._id, __v: 0},
          {_id: '1', rating: 5, text: 'Test 1', createTime: '2022-09-03T16:38:03.447Z', user: user._id, subject: subject._id, __v: 0}]}));
    });

    it('should get articles by subjects name', async () => {
      let user = await new mongoose.models['User'](userParams).save();
      let subject1 = await new mongoose.models['Subject']({ _id: '1', name: 'Test subject 1'}).save();
      let subject2 = await new mongoose.models['Subject']({ _id: '2', name: 'Test subject 2'}).save();
      let subject3 = await new mongoose.models['Subject']({ _id: '3', name: 'Subject 3'}).save();
      let date = Date.now();
      let article1 = await new mongoose.models['Article']({_id: '1', rating: 5, text: 'Test 1', createTime: date, user: user._id, subject: subject1._id}).save();
      subject1.articles.push(article1._id);
      subject1 = await subject1.save();
      let article2 = await new mongoose.models['Article']({_id: '2', rating: 5, text: 'Test 2', createTime: date, user: user._id, subject: subject2._id}).save();
      subject2.articles.push(article2._id);
      subject2 = await subject2.save();
      let article3 = await new mongoose.models['Article']({_id: '3', rating: 5, text: 'Test 3', createTime: date, user: user._id, subject: subject3._id}).save();
      subject3.articles.push(article3._id);
      subject3 = await subject3.save();
      let res = await request(server)
        .get('/content/articles')
        .query({name: 'Test'})
        .expect(200)
        .end();
      res.text.should.be.eql(JSON.stringify({articles: [{_id: '1', rating: 5, text: 'Test 1', createTime: '2022-09-03T16:38:05.447Z', user: user._id, subject: subject1._id, __v: 0},
        {_id: '2', rating: 5, text: 'Test 2', createTime: '2022-09-03T16:38:05.447Z', user: user._id, subject: subject2._id, __v: 0}]}));
    });

    it('should get articles by tag name', async () => {
      let user = await new mongoose.models['User'](userParams).save();
      let tag1 = await new mongoose.models['Tag']({ _id: '1', name: 'Tag1'}).save();
      let tag2 = await new mongoose.models['Tag']({ _id: '2', name: 'Tag2'}).save();
      let subject1 = await new mongoose.models['Subject']({ _id: '1', name: 'Test subject 1', tags: [tag1._id]}).save();
      let subject2 = await new mongoose.models['Subject']({ _id: '2', name: 'Test subject 2', tags: [tag2._id]}).save();
      let date = Date.now();
      let article1 = await new mongoose.models['Article']({_id: '1', rating: 5, text: 'Test 1', createTime: date, user: user._id, subject: subject1._id}).save();
      subject1.articles.push(article1._id);
      subject1 = await subject1.save();
      let article2 = await new mongoose.models['Article']({_id: '2', rating: 5, text: 'Test 2', createTime: date, user: user._id, subject: subject2._id}).save();
      subject2.articles.push(article2._id);
      subject2 = await subject2.save();
      let res = await request(server)
        .get('/content/articles')
        .query({name: 'Tag1'})
        .expect(200)
        .end();
      res.text.should.be.eql(JSON.stringify({articles: [{_id: '1', rating: 5, text: 'Test 1', createTime: '2022-09-03T16:38:05.447Z', user: user._id, subject: subject1._id, __v: 0}]}));
    });

    it('should get articles by user login', async () => {
      let user1 = await new mongoose.models['User']({...userParams, login: 'login1'}).save();
      let user2 = await new mongoose.models['User']({...userParams, login: 'login2', _id: '2'}).save();
      let subject1 = await new mongoose.models['Subject']({ _id: '1', name: 'Test subject 1'}).save();
      let subject2 = await new mongoose.models['Subject']({ _id: '2', name: 'Test subject 2'}).save();
      let date = Date.now();
      let article1 = await new mongoose.models['Article']({_id: '1', rating: 5, text: 'Test 1', createTime: date, user: user1._id, subject: subject1._id}).save();
      subject1.articles.push(article1._id);
      subject1 = await subject1.save();
      let article2 = await new mongoose.models['Article']({_id: '2', rating: 5, text: 'Test 2', createTime: date, user: user2._id, subject: subject2._id}).save();
      subject2.articles.push(article2._id);
      subject2 = await subject2.save();
      let res = await request(server)
        .get('/content/articles')
        .query({name: 'login1'})
        .expect(200)
        .end();
      res.text.should.be.eql(JSON.stringify({articles: [{_id: '1', rating: 5, text: 'Test 1', createTime: '2022-09-03T16:38:05.447Z', user: user1._id, subject: subject1._id, __v: 0}]}));
    });
  });
});
