'use strict';

import Service from '../server.es6';
import request from 'supertest';
import sinon from 'sinon';
import log4js from 'log4js';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

/**
 * @test UserService
 */
describe('UserService', () => {

  const conf = {
    db: {
      url: 'mongodb://127.0.0.1:27017/reviewton-tests'
    },
    secret: 'test'
  };
  let app = new Service();
  let server;
  let sandbox;

  before(async () => {
    sandbox = sinon.createSandbox();
    sandbox.stub(log4js, 'getLogger').returns({
      error: () => {},
      info: () => {}
    });
    await app.start(conf);
    server = app._server;
  });

  afterEach(async () => {
    await app._db.clear();
  });

  after(async () => {
    await app._db.clear();
    await app._db.delete();
    await app.stop();
    sandbox.restore();
  });

  /**
   * @test UserService#register
   */
  describe('register', () => {

    let userParam;
    
    beforeEach(async () => {
      userParam = {
        login: 'test',
        email: 'test@test.com',
        password: 'QwerTY123456',
        passwordRepeat: 'QwerTY123456'
      };
      await app._db.clear();
    });

    it('should return login validation error when login is undefined', async () => {
      delete userParam.login;
      await request(server)
        .post('/user/register')
        .send(userParam)
        .expect(400);
    });

    it('should return login validation error when user with same login already exist', async () => {
      const user = {
        _id: '1',
        email: 'another@mail.com',
        login: userParam.login,
        salt: 'salt',
        hash: 'hash'
      };
      await mongoose.models['User'].create(user);
      await request(server)
        .post('/user/register')
        .send(userParam)
        .expect(400);
    });

    it('should return login validation error when login over max length', async () => {
      userParam.login = '123456789012345678901';
      await request(server)
        .post('/user/register')
        .send(userParam)
        .expect(400);
    });

    it('should return login validation error when login less then min length', async () => {
      userParam.login = '123';
      await request(server)
        .post('/user/register')
        .send(userParam)
        .expect(400);
    });

    it('should return login validation error when user with same email already exist', async () => {
      const user = {
        _id: '1',
        email: userParam.email,
        login: 'anotherLogin',
        salt: 'salt',
        hash: 'hash'
      };
      await mongoose.models['User'].create(user);
      await request(server)
        .post('/user/register')
        .send(userParam)
        .expect(400);
    });

    it('should return email validation error when email is undefined', async () => {
      delete userParam.email;
      await request(server)
        .post('/user/register')
        .send(userParam)
        .expect(400);
    });

    it('should return email validation error when is not valid email', async () => {
      userParam.email = 'email';
      await request(server)
        .post('/user/register')
        .send(userParam)
        .expect(400);
    });

    it('should return password validation error when password is undefined', async () => {
      delete userParam.password;
      await request(server)
        .post('/user/register')
        .send(userParam)
        .expect(400);
    });

    it('should return passwordRepeat validation error when passwordRepeat is undefined', async () => {
      delete userParam.passwordRepeat;
      await request(server)
        .post('/user/register')
        .send(userParam)
        .expect(400);
    });

    it('should return passwordRepeat validation error when passwordRepeat not equal password', async () => {
      userParam.passwordRepeat = 'another-password';
      await request(server)
        .post('/user/register')
        .send(userParam)
        .expect(400);
    });

    it('should return password validation error when password not contain number', async () => {
      userParam.password = 'QwertyqwertY';
      await request(server)
        .post('/user/register')
        .send(userParam)
        .expect(400);
    });

    it('should return password validation error when password not contain small latin', async () => {
      userParam.password = '12345QWERTY';
      await request(server)
        .post('/user/register')
        .send(userParam)
        .expect(400);
    });

    it('should return password validation error when password not contain big latin', async () => {
      userParam.password = '12345qwerty';
      await request(server)
        .post('/user/register')
        .send(userParam)
        .expect(400);
    });

    it('should return password validation error when password smaller then 8 symbols', async () => {
      userParam.password = '123Qw';
      await request(server)
        .post('/user/register')
        .send(userParam)
        .expect(400);
    });

    it('should successful register new user', async () => {
      await request(server)
        .post('/user/register')
        .send(userParam)
        .expect(200);
      
    });
  });

  /**
   * @test UserService#authenticate
   */
  describe('authenticate', () => {

    beforeEach(async () => {
      const user = {
        _id: '1',
        email: 'test@test.com',
        login: 'login',
        salt: 'e2996430759b75a241dcdc846605c227',
        // eslint-disable-next-line max-len
        hash: '2ef725a0fb2fcda3d8632c5a110625c8c70de406bfcfeceb2225ea47973e301480f76ea460c67490c89b2624e3cb16608fdc86321b0188cc43572cf65e28e310'
        //password: 'QwerTY123456'
      };
      await mongoose.models['User'].create(user);
    });

    it('should return credentials validation error when credentials is undefined', async () => {
      let userParam = {
        password: 'QwerTY123456'
      };
      await request(server)
        .post('/user/authenticate')
        .send(userParam)
        .expect(400);
    });

    it('should return credentials password error when password is undefined', async () => {
      let userParam = {
        credentials: 'login'
      };
      await request(server)
        .post('/user/authenticate')
        .send(userParam)
        .expect(400);
    });

    it('should return error if specify wrong credentials', async () => {
      let userParam = {
        credentials: 'anotherlogin',
        password: 'QwerTY123456'
      };
      await request(server)
        .post('/user/authenticate')
        .send(userParam)
        .expect(401);
    });

    it('should return error if specify wrong password', async () => {
      let userParam = {
        credentials: 'login',
        password: 'WrongPass123'
      };
      await request(server)
        .post('/user/authenticate')
        .send(userParam)
        .expect(401);
    });

    it('should authenticate user by login', async () => {
      let userParam = {
        credentials: 'login',
        password: 'QwerTY123456'
      };
      await request(server)
        .post('/user/authenticate')
        .send(userParam)
        .expect(200);
    });

    it('should authenticate user by email', async () => {
      let userParam = {
        credentials: 'test@test.com',
        password: 'QwerTY123456'
      };
      await request(server)
        .post('/user/authenticate')
        .send(userParam)
        .expect(200);
    });
  });

  /**
   * @test UserService#addViewed
   */
  describe('addViewed', () => {
    const user = {
      _id: '1',
      email: 'test@test.com',
      login: 'login',
      salt: 'e2996430759b75a241dcdc846605c227',
      // eslint-disable-next-line max-len
      hash: '2ef725a0fb2fcda3d8632c5a110625c8c70de406bfcfeceb2225ea47973e301480f76ea460c67490c89b2624e3cb16608fdc86321b0188cc43572cf65e28e310'
      //password: 'QwerTY123456'
    };
    const subject = {
      _id: '1',
      name: 'Subject'
    };  
    let article = {
      _id: '1',
      rating: 5,
      text: 'Article',
      user: user._id,
      subject: subject._id,
      createTime: Date.now(),
      comments: []
    };
    let params;
    let token;
    beforeEach(async () => {
      await mongoose.models['User'].create(user);
      await mongoose.models['Subject'].create(subject);
      await mongoose.models['Article'].create(article);
      params = {
        article: article._id
      };
      token = jwt.sign({sub: user._id}, conf.secret, {expiresIn: '7d'});
    });

    it('should return article validation error when article is undefined', async () => {
      delete params.article;
      await request(server)
        .put('/user/1/viewed')
        .send(params)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should return return not found for not existed article', async () => {
      params.article = '2';
      await request(server)
        .put('/user/1/viewed')
        .send(params)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should add viewed article', async () => {
      await request(server)
        .put('/user/1/viewed')
        .send(params)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      let us = await mongoose.models['User'].findById(user._id).lean();
      us.viewed.should.be.eql([params.article]);
      let art = await mongoose.models['Article'].findById(params.article).lean();
      art.views.should.be.eql(1);
    });

    it('should not add already viewed articles', async () => {
      await mongoose.models['User'].updateOne({_id: user._id}, {viewed: [article._id]});
      await mongoose.models['Article'].updateOne({_id: params.article}, {views: 1});
      await request(server)
        .put('/user/1/viewed')
        .send(params)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      let us = await mongoose.models['User'].findById(user._id).lean();
      us.viewed.should.be.eql([params.article]);
      let art = await mongoose.models['Article'].findById(params.article).lean();
      art.views.should.be.eql(1);
    });
  });

  /**
   * @test UserService#getViewed
   */
  describe('getViewed', () => {
    const user = {
      _id: '1',
      email: 'test@test.com',
      login: 'login',
      salt: 'e2996430759b75a241dcdc846605c227',
      // eslint-disable-next-line max-len
      hash: '2ef725a0fb2fcda3d8632c5a110625c8c70de406bfcfeceb2225ea47973e301480f76ea460c67490c89b2624e3cb16608fdc86321b0188cc43572cf65e28e310'
      //password: 'QwerTY123456'
    };
    const subject = {
      _id: '1',
      name: 'Subject'
    };  
    let article = {
      _id: '1',
      rating: 5,
      text: 'Article',
      user: user._id,
      subject: subject._id,
      createTime: Date.now()
    };
    let token;

    beforeEach(async () => {
      await mongoose.models['User'].create(user);
      await mongoose.models['Subject'].create(subject);
      await mongoose.models['Article'].create(article);
      token = jwt.sign({sub: user._id}, conf.secret, {expiresIn: '7d'});
    });

    it('should get empty array if user not have viewed adricles', async () => {
      let res = await request(server)
        .get('/user/1/viewed')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      res.body.should.be.eql({articles: []});
    });

    it('should get viewed adricles', async () => {
      await mongoose.models['User'].updateOne({_id: user._id}, {viewed: [article._id]});
      let res = await request(server)
        .get('/user/1/viewed')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      res.body.should.be.eql(
        {articles: [{...article, createTime: res.body.articles[0].createTime, tags: [], views: 0}]});
    });
  });
});
