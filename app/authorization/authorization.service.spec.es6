'use strict';

import Service from '../server.es6';
import request from 'supertest';
import sinon from 'sinon';
import should from 'should';
import log4js from 'log4js';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

/**
 * @test AuthorizationService
 */
describe('AuthorizationService', () => {

  const conf = {
    db: {
      url: 'mongodb://127.0.0.1:27017/reviewton-tests'
    },
    secret: 'test'
  };
  const app = new Service();
  let server;
  let sandbox;
  let authorization;

  before(async () => {
    sandbox = sinon.createSandbox();
    sandbox.stub(log4js, 'getLogger').returns({
      error: () => {},
      info: () => {}
    });
    await app.start(conf);
    authorization = app._container.resolve('authorizationService');
    server = app._server;
  });

  afterEach(async () => {
    await app._db.clear();
    sandbox.restore();
  });

  after(async () => {
    await app._db.clear();
    await app._db.delete();
    await app.stop();
    sandbox.restore();
  });

  /**
 * @test AuthorizationService#currunt
   */
  describe('current', () => {
    const user = {
      _id: '1',
      email: 'test@test.com',
      login: 'login',
      role: 'user',
      salt: 'e2996430759b75a241dcdc846605c227',
      // eslint-disable-next-line max-len
      hash: '2ef725a0fb2fcda3d8632c5a110625c8c70de406bfcfeceb2225ea47973e301480f76ea460c67490c89b2624e3cb16608fdc86321b0188cc43572cf65e28e310'
      //password: 'QwerTY123456'
    };
    let token;

    beforeEach(async () => {
      await mongoose.models['User'].create(user);
      token = jwt.sign({sub: user._id}, conf.secret, {expiresIn: '7d'});
    });

    it('should return authorization type error', async () => {
      let res = await request(server)
        .get('/authorization/current')
        .set('Authorization', `Type ${token}`)
        .expect(400);
      res.body.message.should.be.eql('Wrong authorization type');
    });

    it('should return authorization type error for empty ', async () => {
      let res = await request(server)
        .get('/authorization/current')
        .set('Authorization', '')
        .expect(400);
      res.body.message.should.be.eql('Wrong authorization type');
    });

    it('should return token expired', async () => {
      token = jwt.sign({sub: user._id}, conf.secret, {expiresIn: -1});
      let res = await request(server)
        .get('/authorization/current')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
      res.body.message.should.be.eql('Token expired');
    });

    it('should return wrong id error', async () => {
      token = jwt.sign({sub: ''}, conf.secret);
      let res = await request(server)
        .get('/authorization/current')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
      res.body.message.should.be.eql('Wrong id');
    });

    it('should return not found error', async () => {
      token = jwt.sign({sub: '2'}, conf.secret);
      let res = await request(server)
        .get('/authorization/current')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
      res.body.message.should.be.eql('User with id 2 not found');
    });

    it('should return user', async () => {
      let res = await request(server)
        .get('/authorization/current')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      res.body.should.be.eql({
        token,
        id: user._id,
        login: user.login,
        email: user.email,
        role: user.role,
        subjectSubscriptions: [],
        tagSubscriptions: [],
        userSubscriptions: []
      });
    });
  });

  /**
 * @test AuthorizationService#authorize
   */
  describe('authorize', () => {

    let authorize;

    before(() => {
      authorize = authorization.authorize();
    });

    it('should return error for token', async () => {
      let next = sandbox.spy();
      await authorize({headers: {}}, {}, next);
      next.called.should.be.eql(true);
    });

    it('should return forbidden error when the method is not available', async () => {
      authorize = authorization.authorize('method');
      sandbox.stub(authorization, '_checkToken').returns({user: {permissions: []}});
      let next = sandbox.spy();
      await authorize({headers: {}}, {}, next);
      next.called.should.be.eql(true);
    });

    it('should authorize user with method', async () => {
      authorize = authorization.authorize('method');
      sandbox.stub(authorization, '_checkToken').returns({user: {permissions: ['method']}});
      let next = sandbox.spy();
      let locals = {};
      await authorize({headers: {}}, {locals}, next);
      locals.user.should.be.eql({permissions: ['method']});
    });
  });
});
