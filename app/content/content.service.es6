'use strict';

import { body, param, validationResult } from 'express-validator';
import log4js from 'log4js';
import { ValidationError } from '../errorHandler/errorHandler.es6';
import { v4 } from 'uuid';
import { UnauthorizedError } from '../errorHandler/errorHandler.es6';
import { NotFoundError } from '../errorHandler/errorHandler.es6';
import { PutObjectCommand, GetObjectCommand, S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import _ from 'lodash';
import sizeOf from 'buffer-image-size';
import crypto from 'crypto';
import path from 'path';
import htmlValidator from 'html-validator';

/**
 * Class for content request
 */
export default class ContentService {

  /**
   * Content service request
   * @param param0 
   * @param {Config} param0.config server config
   * @param {UserModel} param0.userModel user model
   * @param {ArticleModel} param0.articleModel article model
   * @param {CommentModel} param0.commentModel comment model
   * @param {TagModel} param0.tagModel tag model
   * @param {SubjectModel} param0.subjectModel subject model
   */
  constructor({config, userModel, articleModel, commentModel, tagModel, subjectModel}) {
    this._config = config;
    this._userModel = userModel.User;
    this._articleModel = articleModel.Article;
    this._commentModel = commentModel.Comment;
    this._tagModel = tagModel.Tag;
    this._subjectModel = subjectModel.Subject;
    if (config.aws) {
      this._s3 = new S3Client({
        region: config.aws.region,
        credentials: {
          accessKeyId: config.aws.accessKeyId,
          secretAccessKey: config.aws.secretAccessKey 
        }
      });
      this._bucketName = config.aws.bucket;
    }
    this._logger = log4js.getLogger('ContentService');
    this._images = {};
  }

  /**
   * Get unique id
   */
  getId() {
    return v4();
  }

  /**
   * Get articles ordered by time
   */
  async getArticles(req, res, next) {
    try {
      let filter = req.query.filter || '';
      const {limit, offset} = this._checkPagination(req);
      const tags = await this._tagModel.find({ name: {$regex: new RegExp(filter, 'i')}}).select('_id');
      const subjects = await this._subjectModel.find({name: {$regex: new RegExp(filter, 'i')}}).select('_id');
      const users = await this._userModel.find({ login: {$regex: new RegExp(filter, 'i')} }).select('_id');
      let articles = await this._articleModel.
        getAllOrBySubjectOrUserOrTags(subjects, users, tags, false, limit, offset);
      for (let article of articles) {
        article = await this._articleSetData(article, res);
      }
      return res.status(200).json({articles});
    } catch (err) {
      this._logger.error('Error getting articles', err);
      next(err);
    }
  }

  async _articleSetData(article, res) {
    let reactions = await this._userModel.getAritcleReactions(article._id);
    let likes = 0, dislikes = 0;
    reactions.forEach(user => {
      if (user.reaction) {
        likes++;
      } else {
        dislikes++;
      }
      if (user._id === (res.locals.user || {})._id) {
        article.userReaction = user.reaction;
      }
    });
    article.likes = likes;
    article.dislikes = dislikes;
    for (let hash of Object.keys(article.images || {})) {
      let base64 = this._images[hash]?.time ? this._images[hash]?.base64 : 
        await (await this._s3.send(new GetObjectCommand({
          Bucket: this._bucketName,
          Key: article.images[hash]
        }))).Body.transformToString('base64');
      this._images[hash] = {
        base64,
        time: Date.now()
      };
      let type = path.extname(article.images[hash]);
      article.text = article.text.replace(
        new RegExp(`<img src=${hash}>`, 'g'), `<img src="data:image/${type.slice(1, type.length)};` +
        `base64,${this._images[hash].base64}" alt="">`);
    }
    delete article.images;
    this._freeImages();
    return article;
  }

  _freeImages() {
    for (let hash of Object.keys(this._images)) {
      if (Date.now() - this._images[hash].time > this._config.imageCachingTimeInMinutes * 60 * 1000) {
        delete this._images[hash];
      }
    }
  }

  /**
   * Get articles by user ordered by time
   */
  async getArticlesByUserId(req, res, next) {
    try {
      const {limit, offset} = this._checkPagination(req);
      const userId = req.params.userId;
      let articles = await this._articleModel.
        getAllOrBySubjectOrUserOrTags([], [{_id: userId}], [], true, limit, offset);
      for (let article of articles) {
        article = await this._articleSetData(article, res);
      }
      return res.status(200).json({articles});
    } catch (err) {
      this._logger.error('Error getting articles', err);
      next(err);
    }
  }

  /**
   * Get articles by subject ordered by time
   */
  async getArticlesBySubjectId(req, res, next) {
    try {
      const {limit, offset} = this._checkPagination(req);
      const subjectId = req.params.subjectId;
      let articles = await this._articleModel.
        getAllOrBySubjectOrUserOrTags([{_id: subjectId}], [], [], true, limit, offset);
      for (let article of articles) {
        article = await this._articleSetData(article, res);
      }
      return res.status(200).json({articles});
    } catch (err) {
      this._logger.error('Error getting articles', err);
      next(err);
    }
  }

  /**
   * Get articles by tag ordered by time
   */
  async getArticlesByTagId(req, res, next) {
    try {
      const {limit, offset} = this._checkPagination(req);
      const tagId = req.params.tagId;
      let articles = await this._articleModel.
        getAllOrBySubjectOrUserOrTags([], [], [{_id: tagId}], true, limit, offset);
      for (let article of articles) {
        article = await this._articleSetData(article, res);
      }
      return res.status(200).json({articles});
    } catch (err) {
      this._logger.error('Error getting articles', err);
      next(err);
    }
  }

  // eslint-disable-next-line complexity
  async upsertArticle(req, res, next) {
    let newSubject;
    let newTags = [];
    let articleId;
    try {
      await this._validateUpsertArticles(req);
      const userId = res.locals.user._id;
      articleId = _.defaultTo(req.params.articleId, this.getId());
      let newRating;
      let article;
      if (req.params.articleId) {
        article = await this._articleModel.findOne({_id: req.params.articleId});   
        if (!article) {
          throw new NotFoundError(`Not found article with id ${articleId}`);
        }
        if (article.user !== userId) {
          throw new UnauthorizedError('Wrong user defined');
        }
      }
      let subject = await this._subjectModel.findOne({name: req.body.subject});
      if (subject) {        
        let articleOnSubject = await this._articleModel.find(
          {subject: subject._id, user: userId});
        if (articleOnSubject.length && (!article || articleOnSubject.some(a => a._id !== article._id))) {
          throw new ValidationError(`Ви вже маєте відгук на ${subject.name}. ` +
            'Змініть існуючий відгук чи оберіть іншу тему');
        }
      }
      if (article && (!subject || subject._id !== article.subject)) {
        let oldSubject = await this._subjectModel.findById(article.subject);
        let countOld = await this._articleModel.find({subject: oldSubject._id}).count();
        if (countOld > 1) {
          oldSubject.rating = (oldSubject.rating * countOld - article.rating) / (countOld - 1);
          await oldSubject.save();
        } else {
          await this._subjectModel.deleteOne({_id: oldSubject._id});
        }
      }
      if (!subject) {
        subject = new this._subjectModel({ _id: this.getId(), name: req.body.subject});
        await subject.save();
      }
      let count = await this._articleModel.find({subject: subject._id}).count();
      if (req.params.articleId && subject._id === article.subject) {
        let dif = req.body.rating - article.rating;
        newRating = (subject.rating * count + dif) / count;
      } else {
        newRating = (((subject.rating || 0) * Math.max(0, count)) + req.body.rating) /
          (count + 1);
      }
      let tags = [];
      for (let name of (req.body.tags || [])) {
        let tag = await this._tagModel.findOne({name});
        if (!tag) {
          tag = await new this._tagModel({ _id: v4(), name}).save();
          newTags.push(tag._id);
        }
        tags.push(tag);
      }
      let imagesToPush = [];
      if (req.body.text) {
        let isValidHtml = await htmlValidator({data: req.body.text, format: 'text', 
          ignore: ['Error: Start tag seen without seeing a doctype first. Expected “<!DOCTYPE html>”.',
            'Error: Element “head” is missing a required instance of child element “title”.',
            'Error: An “img” element must have an “alt” attribute, except under certain conditions. ' +
            'For details, consult guidance on providing text alternatives for images.',
            'Error: Non-space characters found without seeing a doctype first. Expected “<!DOCTYPE html>”.']});
        if (isValidHtml.includes('There were errors.')) {
          throw new ValidationError('Текст повинен бути правильним html');
        }
        let images = [...req.body.text.matchAll(/<img[^<>]*>/g)];
        images = _.uniq(images.map(i => i[0]));
        if (images.length > this._config.maxArticleImagesCount) {
          throw new ValidationError(
            `Відгук може містити до унікальних ${this._config.maxArticleImagesCount} зображень`);
        }
        for (let image of images) {
          let bufStr = image.match(/,.*"/g)[0];
          bufStr = bufStr.substring(1, bufStr.length - 2);
          let buffer = Buffer.from(bufStr, 'base64');
          let dimensions = sizeOf(buffer);
          if (Math.max(dimensions.height, dimensions.width) > this._config.articleImageMaxSize) {
            throw new ValidationError('The max size of image is 512x512 pixels');
          }
          const hashSum = crypto.createHash('sha256');
          hashSum.update(buffer);
          
          const hex = hashSum.digest('hex');
          imagesToPush.push({buffer, type: dimensions.type, hash: hex, source: image});
        }
      }
      let data = {
        rating: req.body.rating,
        text: req.body.text,
        createTime: article ? article.createTime : new Date(),
        user: userId,
        subject,
        tags: tags.map(t => t._id),
        images: {},
        changed: article ? true : false
      };
      for (let image of _.uniqBy(imagesToPush, 'hash')) {
        let originalname = `${image.hash}.${image.type}`;
        if (!article || !(article.images || {})[image.hash]) {
          await this._s3.send(new PutObjectCommand({
            Body: image.buffer,
            Bucket: this._bucketName,
            Key: `${userId}/articles/${articleId}/${originalname}`
          }));
        }
        data.images[image.hash] = `${userId}/articles/${articleId}/${originalname}`;
        data.text = data.text.replace(new RegExp(
          image.source.replace(/\//g, '\\/').replace(/\+/g, '\\+'), 'g'), `<img src=${image.hash}>`);
      }
      await this._articleModel.updateOne({_id: articleId}, {$set: data},  {upsert: true});
      subject.rating = newRating;
      await subject.save();
      if (article) {
        let oldHashes = _.difference(Object.keys(article.images || {}), Object.keys(data.images || {}));
        for (let hash of oldHashes) {
          await this._s3.send(new DeleteObjectCommand({
            Bucket: this._bucketName,
            Key: article.images[hash]
          }));
        }
      }
      res.status(200).json({_id: articleId});
    } catch (err) {
      this._logger.error('Error upsert article', err);
      try {
        if (newSubject) {
          await this._subjectModel.deleteOne({_id: newSubject});
        }
        if (newTags.length) {
          await this._tagModel.deleteMany({_id: {$in: newTags}});
        }
        if (!req.params.articleId) {
          await this._articleModel.deleteOne({_id: articleId});
        }
      } catch (e) {
        this._logger.error('Can not clear data creating article error', e);
      }
      next(err);
    }
  }
  
  async _validateUpsertArticles(req) {
    try {
      let validations = [
        body('subject')
          .notEmpty().withMessage('Необхідно вказати тему')
          .customSanitizer(value => {return value.replace(/^\s+|\s+$/g, '');}),
        body('rating')
          .notEmpty().withMessage('Необхідно поставити оцінку')
          .isInt({min: 1, max: 5}).withMessage('Оцінка має бути від 1 до 5'),
        body('tags')
          .optional({nullable: true})
          .isArray()
          .custom(value => { return value.every(v => !/^\s*$/.test(v));}).withMessage('Тег не може бути порожнім')
          .customSanitizer(value => {return value.map(el => el.replace(/^\s+|\s+$/g, ''));})
      ];
      await this._validate(req, validations);
    } catch (err) {
      throw new ValidationError('Create article error', err);
    }
  }

  /**
   * Get article by id
   */
  async getArticleById(req, res, next) {
    try {
      const articleId = req.params.articleId;
      let article = await this._articleModel.getArticle(articleId);
      if (!article) {
        throw new NotFoundError(`Not found article with id ${articleId}`);
      }
      article = await this._articleSetData(article, res);
      return res.status(200).json(article);
    } catch (err) {
      this._logger.error(`Failed to get article with id ${req.params.articleId}`, err);
      next(err);
    }
  }

  /**
   * Get tag by id
   */
  async getTagById(req, res, next) {
    try {
      let tagId = req.params.tagId;
      let tag = await this._tagModel.findById(tagId);
      if (!tag) {
        throw new NotFoundError(`Not found Tag with id ${tagId}`);
      }
      return res.status(200).json(tag);
    } catch (err) {
      this._logger.error('Error getting tag by id', err);
      next(err);
    }
  }

  /**
   * Gat tags ordered by articles count
   */
  async getTags(req, res, next) {
    try {
      let filter = req.query.filter || '';
      const {limit, offset} = this._checkPagination(req);
      let tags = await this._tagModel.getTags(filter, limit, offset);
      return res.status(200).json({tags});
    } catch (err) {
      this._logger.error('Error getting tags', err);
      next(err);
    }
  }

  /**
   * Get subject by id
   */
  async getSubjectById(req, res, next) {
    try {
      let subjectId = req.params.subjectId;
      let subject = await this._subjectModel.findById(subjectId);
      if (!subject) {
        throw new NotFoundError(`Not found Subject wit id ${subjectId}`);
      }
      return res.status(200).json(subject);
    } catch (err) {
      this._logger.error('Error getting subject by id', err);
      next(err);
    }
  }

  /**
   * Get subjects ordered by articles count
   */
  async getSubjects(req, res, next) {
    try {
      let filter = req.query.filter || '';
      const {limit, offset} = this._checkPagination(req);
      let subjects = await this._subjectModel.getWithFilter(filter, limit, offset);
      return res.status(200).json({subjects});
    } catch (err) {
      this._logger.error('Error getting subjects', err);
      next(err);
    }
  }

  /**
   * Get users logins, subjects names and tags names for filters
   */
  async getFilters(req, res, next) {
    try {
      const filter = req.params.filter;
      const {limit, offset} = this._checkPagination(req, 10);
      const users = await this._userModel.find({login: {$regex: new RegExp(filter, 'i')}})
        .limit(limit)
        .lean();
      const subjects = await this._subjectModel.find({name: {$regex: new RegExp(filter, 'i')}})
        .limit(limit)
        .lean();
      const tags = await this._tagModel.find({name: {$regex: new RegExp(filter, 'i')}})
        .limit(limit)
        .lean();
      return res.set('Cache-Control', 'public, max-age=300').status(200).json({filters: 
        _.union(users.map(u => u.login), subjects.map(s => s.name), tags.map(t => t.name))});     
    } catch (err) {
      this._logger.error('Error getting filters', err);
      next(err);
    }
  }

  _checkPagination(req, mLimit) {
    let limit = req.query.limit ? +((+req.query.limit).toFixed()) : mLimit ? mLimit : 200;
    let offset = req.query.offset ? +((+req.query.offset).toFixed()) : 0;
    if (limit < 1) {
      limit = 1;
    }
    if (limit > 25) {
      limit = 25;
    }
    if (offset < 0) {
      offset = 0;
    }
    return {limit, offset};
  }

  async _validate(req, validations) {
    await Promise.all(validations.map(validation => validation.run(req)));
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return;
    }
    throw errors;
  }
}
