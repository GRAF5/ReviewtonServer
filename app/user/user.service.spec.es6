'use strict';

import Service from '../server.es6';
import request from 'supertest';
import sinon from 'sinon';
import log4js from 'log4js';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import argon2d from 'argon2';
import should from 'should';

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
   * @test UserService#updateUser
   */
  describe('updateUser', () => {
    let token;
    const user = {
      _id: '1',
      email: 'test@test.com',
      login: 'login',
      salt: 'e2996430759b75a241dcdc846605c227',
      // eslint-disable-next-line max-len
      hash: '2ef725a0fb2fcda3d8632c5a110625c8c70de406bfcfeceb2225ea47973e301480f76ea460c67490c89b2624e3cb16608fdc86321b0188cc43572cf65e28e310'
      //password: 'QwerTY123456'
    };

    beforeEach(async () => {
      await mongoose.models['User'].create(user);
      token = jwt.sign({sub: user._id, token: await argon2d.hash(`${user.login}${user.hash}`)},
        conf.secret, {expiresIn: '7d'});
    });

    it('should return unathorized for bad token', async () => {
      await request(server)
        .put('/user/current')
        .send({
          description: ''
        })
        .set('Authorization', 'Bearer token')
        .expect(400);
    });

    it('should validate email not empty update', async () => {
      await request(server)
        .put('/user/current')
        .send({
          email: ''
        })
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should validate email update', async () => {
      await request(server)
        .put('/user/current')
        .send({
          email: 'test'
        })
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should validate unique email update', async () => {
      await mongoose.models['User'].create({...user, _id:2, email: 'another@test.com'});
      await request(server)
        .put('/user/current')
        .send({
          email: 'another@test.com'
        })
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should update email', async () => {
      await request(server)
        .put('/user/current')
        .send({
          email: 'another@test.com'
        })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      let new_user = await mongoose.models['User'].findOne({email: 'another@test.com'}).lean();
      should(new_user).not.Null();
    });

    it('should validate login not empty update', async () => {
      await request(server)
        .put('/user/current')
        .send({
          login: ''
        })
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should validate login min length update', async () => {
      await request(server)
        .put('/user/current')
        .send({
          login: 'log'
        })
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should validate login max length update', async () => {
      await request(server)
        .put('/user/current')
        .send({
          login: 'logloglogloglogloglog'
        })
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should validate login match update', async () => {
      await request(server)
        .put('/user/current')
        .send({
          login: 'log@'
        })
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should validate login unique update', async () => {
      await mongoose.models['User'].create({...user, _id:2, login: 'login2'});
      await request(server)
        .put('/user/current')
        .send({
          login: 'login2'
        })
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should update login', async () => {
      await request(server)
        .put('/user/current')
        .send({
          login: 'login2'
        })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      let new_user = await mongoose.models['User'].findOne({login: 'login2'}).lean();
      should(new_user).not.Null();
    });

    it('should validate pasword not empty', async () => {
      await request(server)
        .put('/user/current')
        .send({
          password: '',
          newPassword: '321Qwerty',
          newPasswordRepeat: '321Qwerty'
        })
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should validate newPassword not empty', async () => {
      await request(server)
        .put('/user/current')
        .send({
          password: 'QwerTY123456',
          newPassword: '',
          newPasswordRepeat: '321Qwerty'
        })
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should validate newPassword have numbers', async () => {
      await request(server)
        .put('/user/current')
        .send({
          password: 'QwerTY123456',
          newPassword: 'Qwertyuiopasdf',
          newPasswordRepeat: 'Qwertyuiopasdf'
        })
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should validate newPassword have small latin', async () => {
      await request(server)
        .put('/user/current')
        .send({
          password: 'QwerTY123456',
          newPassword: '123456QWERTY',
          newPasswordRepeat: '123456QWERTY'
        })
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should validate newPassword have big latin', async () => {
      await request(server)
        .put('/user/current')
        .send({
          password: 'QwerTY123456',
          newPassword: '12345qwerty',
          newPasswordRepeat: '12345qwerty'
        })
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should validate newPassword have 8 symbols', async () => {
      await request(server)
        .put('/user/current')
        .send({
          password: 'QwerTY123456',
          newPassword: '12Qwe',
          newPasswordRepeat: '12Qwe'
        })
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should validate newPasswordRepeat not empty', async () => {
      await request(server)
        .put('/user/current')
        .send({
          password: 'QwerTY123456',
          newPassword: '321Qwerty',
          newPasswordRepeat: ''
        })
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should validate newPassword equal newPasswordRepeat empty', async () => {
      await request(server)
        .put('/user/current')
        .send({
          password: 'QwerTY123456',
          newPassword: '321Qwerty',
          newPasswordRepeat: '321QwertyBad'
        })
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should change password', async () => {
      await request(server)
        .put('/user/current')
        .send({
          password: 'QwerTY123456',
          newPassword: '321Qwerty',
          newPasswordRepeat: '321Qwerty'
        })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      let new_user = await mongoose.models['User'].findOne({login: 'login'}).lean();
      should(new_user.hash).not.eql(user.hash);
      should(new_user.salt).not.eql(user.salt);
    });

    it('should validate description max length', async () => {
      await request(server)
        .put('/user/current')
        .send({
          description: 'Descr'.repeat(128)
        })
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should change description', async () => {
      await request(server)
        .put('/user/current')
        .send({
          description: 'Description'
        })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      let new_user = await mongoose.models['User'].findOne({description: 'Description'}).lean();
      console.log(new_user);
      should(new_user.description).eql('Description');
    });
  });
});
