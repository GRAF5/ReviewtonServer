'use strict';

import Service from '../server.es6';
import request from 'supertest';
import sinon from 'sinon';
import log4js from 'log4js';
import mongoose from 'mongoose';
import should from 'should';
import jwt from 'jsonwebtoken';

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

  before(async () => {
    sandbox = sinon.createSandbox();
    sandbox.stub(log4js, 'getLogger').returns({
      error: () => {},
      info: () => {}
    });
    await app.start(conf);
    server = app._server;
    sandbox.useFakeTimers({toFake: ['Date'], now: Date.parse('2022-09-03T16:38:05.447Z')});
    contentService = app._container.resolve('contentService');
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
   * @test ContentService#getArticles
   */
  describe('getArticles', () => {

    it('should get empty array if there no articles', async () => {
      let res = await request(server)
        .get('/content/articles')
        .expect(200);
      res.text.should.be.eql(JSON.stringify({articles: []}));
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
          subject: subject, tags:[], views: 0, commentsCount: 0, likes: 0, dislikes: 0},
        {_id: '2', rating: 5, text: 'Test 2', 
          createTime: '2022-09-03T16:38:05.447Z', user: {_id: user._id, login: user.login}, 
          subject: subject, tags:[], views: 0, commentsCount: 0, likes: 0, dislikes: 0}]}));
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
          subject: subject, tags:[], views: 0, commentsCount: 0, likes: 0, dislikes: 0},
        {_id: '3', rating: 5, text: 'Test 3', 
          createTime: '2022-09-03T16:38:04.447Z', user: {_id: user._id, login: user.login}, 
          subject: subject, tags:[], views: 0, commentsCount: 0, likes: 0, dislikes: 0},
        {_id: '1', rating: 5, text: 'Test 1', 
          createTime: '2022-09-03T16:38:03.447Z', user: {_id: user._id, login: user.login}, 
          subject: subject, tags:[], views: 0, commentsCount: 0, likes: 0, dislikes: 0}]}));
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
        .query({name: 'Test'})
        .expect(200);
      res.text.should.be.eql(JSON.stringify({articles: [
        {_id: '1', rating: 5, text: 'Test 1', 
          createTime: '2022-09-03T16:38:05.447Z', user: {_id: user._id, login: user.login}, 
          subject: subject1, tags:[], views: 0, commentsCount: 0, likes: 0, dislikes: 0},
        {_id: '2', rating: 5, text: 'Test 2', 
          createTime: '2022-09-03T16:38:05.447Z', user: {_id: user._id, login: user.login}, 
          subject: subject2, tags:[], views: 0, commentsCount: 0, likes: 0, dislikes: 0}]}));
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
        .query({name: 'Tag1'})
        .expect(200);
      res.text.should.be.eql(JSON.stringify({articles: [
        {_id: '1', rating: 5, text: 'Test 1', 
          createTime: '2022-09-03T16:38:05.447Z', user: {_id: user._id, login: user.login}, 
          subject: sub1, tags:[tag1], views: 0, commentsCount: 0, likes: 0, dislikes: 0}]}));
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
        .query({name: 'login1'})
        .expect(200);
      res.text.should.be.eql(JSON.stringify({articles: [
        {_id: '1', rating: 5, text: 'Test 1', 
          createTime: '2022-09-03T16:38:05.447Z', user: {_id: user1._id, login: user1.login}, 
          subject: sub1, tags:[], views: 0, commentsCount: 0, likes: 0, dislikes: 0}]}));
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
    
    it('should get all tags if name not defined', async () => {
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
        {_id: '2', name: 'Tag2', articleCount: 2},
        {_id: '1', name: 'Tag1', articleCount: 1}
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
        { _id: '2', name: 'Tag2', articleCount: 3},
        { _id: '3', name: 'Tag3', articleCount: 2},
        { _id: '1', name: 'Tag1', articleCount: 1}]}));
    });
    
    it('should get tags by name', async () => {
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
        .query({name: '1'})
        .expect(200);
      res.text.should.be.eql(JSON.stringify({tags: [
        {_id: '1', name: 'Tag1', articleCount: 1}
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
      token = jwt.sign({sub: user._id}, conf.secret, {expiresIn: '7d'});
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
        tags: [],
        views: 0,
        user: user._id
      });
      Date(article.createTime).should.be.eql(Date(Date.now()));
      let subject = await mongoose.models['Subject'].findById(article.subject).lean();
      subject.name.should.be.eql(articleParam.subject);
      subject.rating.should.be.eql(articleParam.rating);
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
          createTime: Date.now(), user: user._id, subject: sub._id, tags: [tag._id]}).save();
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
      await mongoose.models['Article'].create({...article, _id: 12, rating: 2});
      token = jwt.sign({sub: user._id}, conf.secret, {expiresIn: '7d'});
    });

    it('should return UnauthorizedError if auth wrong user', async () => {
      let wrongToken = jwt.sign({sub: '2'}, conf.secret, {expiresIn: '7d'});
      await mongoose.models['User'].create({...user, _id: '2'});
      await request(server)
        .put('/content/articles/1')
        .send({
          rating: 3
        })
        .set('Authorization', `Bearer ${wrongToken}`)
        .expect(401);
    });

    it('should return article validation error when defined wrong id', async () => {
      await request(server)
        .put('/content/articles/2')
        .send({})
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should return rating validation error when rating over max', async () => {
      await request(server)
        .put('/content/articles/1')
        .send({
          rating: 6
        })
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should return rating validation error when rating less then min', async () => {
      await request(server)
        .put('/content/articles/1')
        .send({
          rating: 0
        })
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should update article text', async () => {
      await request(server)
        .put('/content/articles/1')
        .send({
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

  // /**
  //  * @test ContentService#createComment
  //  */
  // describe('createComment', () => {

  //   const user = {
  //     _id: '1',
  //     email: 'test@test.com',
  //     login: 'login',
  //     permissions: [
  //       'create-article',
  //       'update-article',
  //       'create-comment',
  //       'update-comment'
  //     ],
  //     salt: 'e2996430759b75a241dcdc846605c227',
  // eslint-disable-next-line max-len
  //     hash: '2ef725a0fb2fcda3d8632c5a110625c8c70de406bfcfeceb2225ea47973e301480f76ea460c67490c89b2624e3cb16608fdc86321b0188cc43572cf65e28e310'
  //     //password: 'QwerTY123456'
  //   };
  //   const subject = {
  //     _id: '1',
  //     name: 'Subject'
  //   };  
  //   const article = {
  //     _id: '1',
  //     rating: 5,
  //     text: 'Article',
  //     user: user._id,
  //     subject: subject._id,
  //     createTime: Date.now()
  //   };
  //   let commentParam;
  //   let token;

  //   beforeEach(async () => {
  //     await mongoose.models['User'].create(user);
  //     await mongoose.models['Subject'].create(subject);
  //     await mongoose.models['Article'].create(article);
  //     commentParam = {
  //       text: 'Comment text'
  //     };
  //     token = jwt.sign({sub: user._id}, conf.secret, {expiresIn: '7d'});
  //   });
    
  //   it('should return text validation error when text is undefined', async () => {
  //     delete commentParam.text;
  //     await request(server)
  //       .post(`/content/articles/${article._id}/comments`)
  //       .send(commentParam)
  //       .set('Authorization', `Bearer ${token}`)
  //       .expect(400);
  //   });
    
  //   it('should return text validation error when text is empty', async () => {
  //     commentParam.text = '   \n    ';
  //     await request(server)
  //       .post(`/content/articles/${article._id}/comments`)
  //       .send(commentParam)
  //       .set('Authorization', `Bearer ${token}`)
  //       .expect(400);
  //   });
    
  //   it('should return article validation error when defined wrong article', async () => {
  //     commentParam.article = 'wrongID';
  //     await request(server)
  //       .post('/content/articles/wrongID/comments')
  //       .send(commentParam)
  //       .set('Authorization', `Bearer ${token}`)
  //       .expect(400);
  //   });
    
  //   it('should create comment', async () => {
  //     let res = await request(server)
  //       .post(`/content/articles/${article._id}/comments`)
  //       .send(commentParam)
  //       .set('Authorization', `Bearer ${token}`)
  //       .expect(200);
  //     let comment = await mongoose.models['Comment'].findById(res.body._id).lean();
  //     comment.text.should.be.eql(commentParam.text);
  //     comment.user.should.be.eql(user._id);
  //     comment.article.should.be.eql(article._id);
  //   });
  // });

  // /**
  //  * @test ContentService#updateComment
  //  */
  // describe('updateComment', () => {
    
  //   let token;
  //   const user = {
  //     _id: '1',
  //     email: 'test@test.com',
  //     login: 'login',
  //     permissions: [
  //       'create-article',
  //       'update-article',
  //       'create-comment',
  //       'update-comment'
  //     ],
  //     salt: 'e2996430759b75a241dcdc846605c227',
  // eslint-disable-next-line max-len
  //     hash: '2ef725a0fb2fcda3d8632c5a110625c8c70de406bfcfeceb2225ea47973e301480f76ea460c67490c89b2624e3cb16608fdc86321b0188cc43572cf65e28e310'
  //     //password: 'QwerTY123456'
  //   };
  //   const subject = {
  //     _id: '1',
  //     rating: 3.5,
  //     name: 'Subject'
  //   };
  //   const article = {
  //     _id: '1',
  //     user: user._id,
  //     subject: subject._id,
  //     rating: 3,
  //     text: 'Text',
  //     createTime: Date.now()
  //   };
  //   const comment = {
  //     _id: '1',
  //     user: user._id,
  //     text: 'Text',
  //     article: article._id,
  //     createTime: Date.now()
  //   };

  //   beforeEach(async () => {
  //     await mongoose.models['User'].create(user);
  //     let sub = await mongoose.models['Subject'].create(subject);
  //     await mongoose.models['Article'].create(article);
  //     sub.articles = [article.id, '2'];
  //     await sub.save();
  //     await mongoose.models['Comment'].create(comment);
  //     token = jwt.sign({sub: user._id}, conf.secret, {expiresIn: '7d'});
  //   });

  //   it('should return UnauthorizedError if auth wrong user', async () => {
  //     let wrongToken = jwt.sign({sub: '2'}, conf.secret, {expiresIn: '7d'});
  //     await mongoose.models['User'].create({...user, _id: '2'});
  //     await request(server)
  //       .put(`/content/articles/${article._id}/comments/${comment._id}`)
  //       .send({
  //         text: 'Text'
  //       })
  //       .set('Authorization', `Bearer ${wrongToken}`)
  //       .expect(401);
  //   });

  //   it('should return comment validation error when defined wrong id', async () => {
  //     await request(server)
  //       .put(`/content/articles/${article._id}/comments/2`)
  //       .send({
  //         text: 'Text'
  //       })
  //       .set('Authorization', `Bearer ${token}`)
  //       .expect(400);
  //   });

  //   it('should return text validation error when text not defined', async () => {
  //     await request(server)
  //       .put(`/content/articles/${article._id}/comments/${comment._id}`)
  //       .send({})
  //       .set('Authorization', `Bearer ${token}`)
  //       .expect(400);
  //   });

  //   it('should return text validation error when text is empty', async () => {
  //     await request(server)
  //       .put(`/content/articles/${article._id}/comments/${comment._id}`)
  //       .send({
  //         text: '   '
  //       })
  //       .set('Authorization', `Bearer ${token}`)
  //       .expect(400);
  //   });

  //   it('should update comment', async () => {
  //     await request(server)
  //       .put(`/content/articles/${article._id}/comments/${comment._id}`)
  //       .send({
  //         text: 'Another text'
  //       })
  //       .set('Authorization', `Bearer ${token}`)
  //       .expect(200);
  //     let com = await mongoose.models['Comment'].findById(comment._id).lean();
  //     com.text.should.be.eql('Another text');
  //   });
  // });

  // /**
  //  * @test ContentService#getComments
  //  */
  // describe('getComments', () => {

  //   const user = {
  //     _id: '1',
  //     email: 'test@test.com',
  //     login: 'login',
  //     permissions: [
  //       'create-article',
  //       'update-article',
  //       'create-comment',
  //       'update-comment'
  //     ],
  //     salt: 'e2996430759b75a241dcdc846605c227',
  // eslint-disable-next-line max-len
  //     hash: '2ef725a0fb2fcda3d8632c5a110625c8c70de406bfcfeceb2225ea47973e301480f76ea460c67490c89b2624e3cb16608fdc86321b0188cc43572cf65e28e310'
  //     //password: 'QwerTY123456'
  //   };
  //   const subject = {
  //     _id: '1',
  //     name: 'Subject'
  //   };  
  //   let article = {
  //     _id: '1',
  //     rating: 5,
  //     text: 'Article',
  //     user: user._id,
  //     subject: subject._id,
  //     createTime: Date.now(),
  //     comments: []
  //   };
  //   let params;

  //   beforeEach(async () => {
  //     await mongoose.models['User'].create(user);
  //     await mongoose.models['Subject'].create(subject);
  //   });

  //   it('should return article validation error when defined wrong article', async () => {
  //     await mongoose.models['Article'].create(article);
  //     await request(server)
  //       .get('/content/articles/wrongID/comments')
  //       .expect(400);
  //   });

  //   it('should get empty array if no comments', async () => {
  //     await mongoose.models['Article'].create(article);
  //     let res = await request(server)
  //       .get(`/content/articles/${article._id}/comments`)
  //       .expect(200);
  //     res.body.should.be.eql({comments: []});
  //   });

  //   it('should get article comments', async () => {
  //     const comment = {
  //       _id: '1',
  //       text: 'Comment Text',
  //       user: user._id,
  //       article: article._id,
  //       createTime: Date.now()
  //     };
  //     await mongoose.models['Article'].create(article);
  //     await mongoose.models['Comment'].create(comment);
  //     let res = await request(server)
  //       .get(`/content/articles/${article._id}/comments`)
  //       .send(params)
  //       .expect(200);
  //     res.body.should.be.eql({comments: [{
  //       ...comment,
  //       replyCount: 0,
  //       createTime: res.body.comments[0].createTime,
  //       user: {
  //         _id: user._id,
  //         login: user.login
  //       }
  //     }]});
  //   });
  // });
  
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
