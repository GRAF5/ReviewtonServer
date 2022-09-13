'use strict';

import log4js from 'log4js';
import { ValidationError } from '../errorHandler/errorHandler.es6';
import { v4 } from 'uuid';

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
    this._logger = log4js.getLogger('ContentService');
  }

  /**
   * Get articles ordered by time
   */
  async getArticles(req, res, next) {
    try {
      let name = req.query.name || '';
      const {limit, offset} = this._checkPagination(req);
      const tags = await this._tagModel.find({ name: {$regex: name}}).select('_id');
      const subjects = await this._subjectModel.getIdsByName(name);
      const users = await this._userModel.find({ login: {$regex: name} }).select('_id');
      let articles = await this._articleModel.getAllOrBySubjectOrUserOrTags(subjects, users, tags, limit, offset);
      return res.status(200).json({articles});
    } catch (err) {
      this._logger.error('Error while getting articles', err);
      next(err);
    }
  }

  /**
   * Create new article
   */
  // eslint-disable-next-line complexity
  async createArticle(req, res, next) {
    let newSubject;
    let newTags = [];
    let article;
    try {
      let errors = [];
      if (!req.body.user) {
        errors.push({
          arg: 'user',
          message: 'Необхідно вказати автора'
        });
      } 
      let user = await this._userModel.findOne({_id: req.body.user});
      if (!user) {
        errors.push({
          arg: 'user',
          message: 'Користувача не знайдено'
        });
      }
      if (!req.body.subject) {
        errors.push({
          arg: 'subject',
          message: 'Необхідно вказати тему'
        });
      }
      if (!req.body.rating) {
        errors.push({
          arg: 'rating',
          message: 'Необхідно поставити оцінку'
        });
      }
      req.body.rating = ((+req.body.rating).toFixed());
      if (req.body.rating > 5 || req.body.rating < 1) {
        errors.push({
          arg: 'rating',
          message: 'Оцінка має бути від 1 до 5'
        });
      }
      if (errors.length) {
        throw new ValidationError('Create article error', errors);
      }
      req.body.subject = req.body.subject.replace(/^\s+|\s+$/g, '');
      let subject = await this._subjectModel.findOne({name: req.body.subject});
      if (!subject) {
        subject = new this._subjectModel({ _id: v4(), name: req.body.subject});
        await subject.save();
        newSubject = subject._id;
      }
      let tags = [];
      for (let name of (req.body.tags || [])) {
        name = name.replace(/^\s+|\s+$/g, '');
        let tag = await this._tagModel.findOne({name});
        if (!tag) {
          tag = await new this._tagModel({ _id: v4(), name}).save();
          newTags.push(tag._id);
        }
        tags.push(tag);
      }
      article = await new this._articleModel({
        _id: v4(),
        rating: req.body.rating,
        text: req.body.text,
        createTime: new Date(),
        user: req.body.user,
        subject,
        tags: tags.map(t => t._id)
      }).save();
      subject.rating = ((subject.rating * subject.articles?.length || 0) + article.rating) /
        (subject.articles?.length + 1);
      subject.articles.push(article._id);
      await subject.save();
      tags.forEach(async (tag) => {
        tag.articles.push(article._id);
        await tag.save();
      });
      user.articles.push(article._id);
      await user.save();
      res.status(200).json({_id: article._id});
    } catch (err) {
      this._logger.error('Error while create article', err);
      try {
        if (newSubject) {
          await this._subjectModel.deleteOne({_id: newSubject});
        }
        if (newTags.length) {
          await this._tagModel.deleteMany({_id: {$in: newTags}});
        }
        if (article) {
          await this._articleModel.deleteOne({_id: article._id});
        }
      } catch (e) {
        this._logger.error('Can not clear data while create article error', e);
      }
      next(err);
    }
  }

  /**
   * Gat tags ordered by articles count
   */
  async getTags(req, res, next) {
    try {
      let name = req.query.name || '';
      const {limit, offset} = this._checkPagination(req);
      let tags = await this._tagModel.getTags(name, limit, offset);
      return res.status(200).json({tags});
    } catch (err) {
      this._logger.error('Error while getting tags', err);
      next(err);
    }
  }

  /**
   * Create new comment
   */
  // eslint-disable-next-line complexity
  async createComment(req, res, next) {
    let comment;
    try {
      let errors = [];
      if (!req.body.user) {
        errors.push({
          arg: 'user',
          message: 'Необхідно вказати автора'
        });
      } 
      let user = await this._userModel.findOne({_id: req.body.user});
      if (!user) {
        errors.push({
          arg: 'user',
          message: 'Користувача не знайдено'
        });
      }
      if (!req.body.text || /^(\s+|)$/.test(req.body.text)) {
        errors.push({
          arg: 'text',
          message: 'Необхідно додати текст'
        });
      }
      if (!req.body.article) {
        errors.push({
          arg: 'article',
          message: 'Необхідно вказати статтю'
        });
      }
      let article = await this._articleModel.findOne({_id: req.body.article});
      if (!article) {
        errors.push({
          arg: 'article',
          message: 'Статті не знайдено'
        });
      }
      if (errors.length) {
        throw new ValidationError('Create comment error', errors);
      }
      comment = await new this._commentModel({
        _id: v4(),
        text: req.body.text,
        user: req.body.user,
        article: req.body.article,
        createTime: Date.now()
      }).save();
      article.comments.push(comment._id);
      article.save();
      user.comments.push(comment._id);
      user.save();
      res.status(200).json({_id: comment._id});
    } catch (err) {
      this._logger.error('Error while create comment', err);
      try {
        if (comment) {
          await this._commentModel.deleteOne({_id: comment._id});
        }
      } catch (e) {
        this._logger.error('Can not clear data while create comment error', e);
      }
      next(err);
    }
  }

  /**
   * Get comments by article 
   */
  async getComments(req, res, next) {
    try {
      let errors = [];
      const {limit, offset} = this._checkPagination(req);
      if (!req.body.article) {
        errors.push({
          arg: 'article',
          message: 'Необхідно вказати статтю'
        });
      }
      let article = await this._articleModel.findOne({_id: req.body.article});
      if (!article) {
        errors.push({
          arg: 'article',
          message: 'Статті не знайдено'
        });
      }
      if (errors.length) {
        throw new ValidationError('Create comment error', errors);
      }
      let comments = await this._commentModel.find({article: req.body.article})
        .sort('-createTime')
        .skip(offset)
        .limit(limit)
        .populate('user', ['login'])
        .lean();
      return res.status(200).json({comments});
    } catch (err) {
      this._logger.error('Error while getting comment', err);
      next(err);
    }
  }

  _checkPagination(req) {
    let limit = req.query.limit ? +((+req.query.limit).toFixed()) : 25;
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
}
