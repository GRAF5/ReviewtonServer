'use strict';

import { body, param, validationResult } from 'express-validator';
import log4js from 'log4js';
import { ValidationError } from '../errorHandler/errorHandler.es6';
import { v4 } from 'uuid';
import { UnauthorizedError } from '../errorHandler/errorHandler.es6';
import { NotFoundError } from '../errorHandler/errorHandler.es6';

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
      const subjects = await this._subjectModel.find({name: {$regex: name}}).select('_id');
      const users = await this._userModel.find({ login: {$regex: name} }).select('_id');
      let articles = await this._articleModel.getAllOrBySubjectOrUserOrTags(subjects, users, tags, limit, offset);
      for (let article of articles) {
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
      }
      return res.status(200).json({articles});
    } catch (err) {
      this._logger.error('Error getting articles', err);
      next(err);
    }
  }

  /**
   * Get articles ordered by time
   */
  async getArticlesByUserId(req, res, next) {
    try {
      const {limit, offset} = this._checkPagination(req);
      const userId = req.params.userId;
      let articles = await this._articleModel.getAllOrBySubjectOrUserOrTags([], [{_id: userId}], [], limit, offset);
      for (let article of articles) {
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
      }
      return res.status(200).json({articles});
    } catch (err) {
      this._logger.error('Error getting articles', err);
      next(err);
    }
  }

  /**
   * Get articles ordered by time
   */
  async getArticlesBySubjectId(req, res, next) {
    try {
      const {limit, offset} = this._checkPagination(req);
      const subjectId = req.params.subjectId;
      let articles = await this._articleModel.getAllOrBySubjectOrUserOrTags([{_id: subjectId}], [], [], limit, offset);
      for (let article of articles) {
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
      }
      return res.status(200).json({articles});
    } catch (err) {
      this._logger.error('Error getting articles', err);
      next(err);
    }
  }

  /**
   * Get articles ordered by time
   */
  async getArticlesByTagId(req, res, next) {
    try {
      const {limit, offset} = this._checkPagination(req);
      const tagId = req.params.tagId;
      let articles = await this._articleModel.getAllOrBySubjectOrUserOrTags([], [], [{_id: tagId}], limit, offset);
      for (let article of articles) {
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
      }
      return res.status(200).json({articles});
    } catch (err) {
      this._logger.error('Error getting articles', err);
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
      await this._validateCreateArticles(req);
      const userId = res.locals.user._id;
      let user = await this._userModel.findOne({_id: userId});
      let subject = await this._subjectModel.findOne({name: req.body.subject});
      if (!subject) {
        subject = new this._subjectModel({ _id: v4(), name: req.body.subject});
        await subject.save();
        newSubject = subject._id;
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
      article = await new this._articleModel({
        _id: v4(),
        rating: req.body.rating,
        text: req.body.text,
        createTime: new Date(),
        user: userId,
        subject,
        tags: tags.map(t => t._id)
      }).save();
      let count = await this._articleModel.find({subject: subject._id}).count();
      subject.rating = ((subject.rating * (count - 1) || 0) + article.rating) /
        count;
      await subject.save();
      res.status(200).json({_id: article._id});
    } catch (err) {
      this._logger.error('Error creating article', err);
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
        this._logger.error('Can not clear data creating article error', e);
      }
      next(err);
    }
  }
  
  async _validateCreateArticles(req) {
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
          .customSanitizer(value => {return value.map(el => el.replace(/^\s+|\s+$/g, ''));})
      ];
      await this._validate(req, validations);
    } catch (err) {
      throw new ValidationError('Create article error', err);
    }
  }

  /**
   * Update article 
   */
  async updateArticle(req, res, next) {
    try {
      await this._validateUpdateArticle(req);
      let article = await this._articleModel.findOne({_id: req.params.articleId});
      const userId = res.locals.user._id;
      if (article.user !== userId) {
        throw new UnauthorizedError('Wrong user defined');
      }
      if (req.body.text !== article.text) {
        article.text = req.body.text;
      }
      if (req.body.rating && (req.body.rating !== article.rating)) {
        let dif = req.body.rating - article.rating;
        article.rating = req.body.rating;
        await article.save();
        let subject = await this._subjectModel.findOne({_id: article.subject});
        let count = await this._articleModel.find({subject: subject._id}).count();
        subject.rating = (subject.rating * count + dif) / count;
        await subject.save();
      } else {
        await article.save();
      }
      res.status(200).send();
    } catch (err) {
      this._logger.error('Error updating article', err);
      next(err);
    }
  }

  async _validateUpdateArticle(req) {
    try {
      let validations = [
        param('articleId')
          .notEmpty().withMessage('Необхідно вказати статтю')
          .custom((value) => {
            let query = this._articleModel.findOne({ _id: value});
            return query.exec().then(article => {
              if (!article) {
                return Promise.reject('Статті не знайдено');
              }
            });
          }),
        body('rating')
          .optional()
          .isInt({min: 1, max: 5}).withMessage('Оцінка має бути від 1 до 5')
      ];
      await this._validate(req, validations);
    } catch (err) {
      throw new ValidationError('Update article error', err);
    }
  }

  // async estimateArticle(req, res, next) {
  //   try {
  //     await this._validateEstimateArticle(req);
  //     let article = await this._articleModel.findOne({_id: req.params.articleId});
  //     if (req.body.grade) {
  //       article.likes++;
  //     } else {
  //       article.dislikes++;
  //     }
  //     await article.save();
  //     article.commentsCount = await this._commentModel.find({article: req.params.article._id}).count();
  //     res.status(202).json(article);
  //   } catch (err) {
  //     this._logger.error('Failed to rate article', err);
  //     next(err);
  //   }
  // }

  // async _validateEstimateArticle(req) {
  //   try {
  //     let validations = [
  //       param('articleId')
  //         .notEmpty().withMessage('Необхідно вказати статтю')
  //         .custom((value) => {
  //           let query = this._articleModel.findOne({ _id: value});
  //           return query.exec().then(article => {
  //             if (!article) {
  //               return Promise.reject('Статті не знайдено');
  //             }
  //           });
  //         }),
  //       body('grade')
  //         .notEmpty().withMessage('Необхідно вказати лайк чи дізлайк')
  //         .isBoolean().withMessage('Оцінка має бути true чи false')
  //     ];
  //     await this._validate(req, validations);
  //   } catch (err) {
  //     throw new ValidationError('Estimate article error', err);
  //   }
  // }

  async getTagById(req, res, next) {
    try {
      let tagId = req.params.tagId;
      let tag = await this._tagModel.findById(tagId);
      if (!tag) {
        throw new NotFoundError(`Not found Tag wit id ${tagId}`);
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

  // /**
  //  * Create new comment
  //  */
  // async createComment(req, res, next) {
  //   let comment;
  //   try {
  //     await this._validateCreateComment(req);
  //     const userId = res.locals.user._id;
  //     comment = await new this._commentModel({
  //       _id: v4(),
  //       text: req.body.text,
  //       user: userId,
  //       article: req.params.articleId,
  //       createTime: Date.now()
  //     }).save();
  //     res.status(200).json({_id: comment._id});
  //   } catch (err) {
  //     this._logger.error('Error creating comment', err);
  //     try {
  //       if (comment) {
  //         await this._commentModel.deleteOne({_id: comment._id});
  //       }
  //     } catch (e) {
  //       this._logger.error('Can not clear data create comment error', e);
  //     }
  //     next(err);
  //   }
  // }

  // async _validateCreateComment(req) {
  //   try {
  //     let validations = [
  //       body('text')
  //         .not().matches(/^(\s+|)$/).withMessage('Необхідно вказати текст'),
  //       param('articleId')
  //         .notEmpty().withMessage('Необхідно вказати статтю')
  //         .custom((value) => {
  //           let query = this._articleModel.findOne({ _id: value});
  //           return query.exec().then(article => {
  //             if (!article) {
  //               return Promise.reject('Статті не знайдено');
  //             }
  //           });
  //         })
  //     ];
  //     await this._validate(req, validations);
  //   } catch (err) {
  //     throw new ValidationError('Create comment error', err);
  //   }
  // }

  // /**
  //  * Update comment 
  //  */
  // async updateComment(req, res, next) {
  //   try {
  //     await this._validateUpdateComment(req);
  //     let comment = await this._commentModel.findOne({_id: req.params.commentId});
  //     const userId = res.locals.user._id;
  //     if (comment.user !== userId) {
  //       throw new UnauthorizedError('Wrong user defined');
  //     }
  //     comment.text = req.body.text;
  //     await comment.save();
  //     res.status(200).send();
  //   } catch (err) {
  //     this._logger.error('Error updating comment', err);
  //     next(err);
  //   }
  // }  

  // async _validateUpdateComment(req) {
  //   try {
  //     let validations = [
  //       param('commentId')
  //         .notEmpty().withMessage('Необхідно вказати комент')
  //         .custom((value) => {
  //           let query = this._commentModel.findOne({ _id: value});
  //           return query.exec().then(comment => {
  //             if (!comment) {
  //               return Promise.reject('Коментаря не знайдено');
  //             }
  //           });
  //         }),
  //       body('text')
  //         .not().matches(/^(\s+|)$/).withMessage('Необхідно вказати текст')
  //     ];
  //     await this._validate(req, validations);
  //   } catch (err) {
  //     throw new ValidationError('Update comment error', err);
  //   }
  // }

  // /**
  //  * Get comments by article 
  //  */
  // async getComments(req, res, next) {
  //   try {
  //     await this._validateGetComments(req);
  //     const {limit, offset} = this._checkPagination(req);
  //     let comments = await this._commentModel.find({article: req.params.articleId, comment: undefined})
  //       .sort('createTime')
  //       .skip(offset)
  //       .limit(limit)
  //       .populate('user', ['login'])
  //       .lean();
  //     for (let comment of comments) {
  //       let replyCount = await this._commentModel.find({comment: comment._id}).count();
  //       comment.replyCount = replyCount;
  //     }
  //     return res.status(200).json({comments});
  //   } catch (err) {
  //     this._logger.error('Error getting comment', err);
  //     next(err);
  //   }
  // }

  // /**
  //  * Get comments by article 
  //  */
  // async getAnswers(req, res, next) {
  //   try {
  //     await this._validateGetComments(req);
  //     const {limit, offset} = this._checkPagination(req);
  //     let comments = await this._commentModel.find({article: req.params.articleId, comment: req.params.commentId})
  //       .sort('createTime')
  //       .skip(offset)
  //       .limit(limit)
  //       .populate('user', ['login'])
  //       .lean();
  //     for (let comment of comments) {
  //       let replyCount = await this._commentModel.find({comment: comment._id}).count();
  //       comment.replyCount = replyCount;
  //     }
  //     return res.status(200).json({comments});
  //   } catch (err) {
  //     this._logger.error('Error getting comment', err);
  //     next(err);
  //   }
  // }
  
  // async _validateGetComments(req) {
  //   try {
  //     let validations = [
  //       param('articleId')
  //         .notEmpty().withMessage('Необхідно вказати статтю')
  //         .custom((value) => {
  //           let query = this._articleModel.findOne({ _id: value});
  //           return query.exec().then(article => {
  //             if (!article) {
  //               return Promise.reject('Статті не знайдено');
  //             }
  //           });
  //         })
  //     ];
  //     await this._validate(req, validations);
  //   } catch (err) {
  //     throw new ValidationError('Get comment error', err);
  //   }
  // }

  // async createAnswer(req, res, next) {
  //   let answer;
  //   try {
  //     await this._validateCreateAnswer(req);
  //     const userId = res.locals.user._id;
  //     answer = await new this._commentModel({
  //       _id: v4(),
  //       text: req.body.text,
  //       user: userId,
  //       article: req.params.articleId,
  //       createTime: Date.now(),
  //       comment: req.params.commentId
  //     }).save();
  //     res.status(200).json({_id: answer._id});
  //   } catch (err) {
  //     this._logger.error('Error creating comment', err);
  //     try {
  //       if (answer) {
  //         await this._commentModel.deleteOne({_id: answer._id});
  //       }
  //     } catch (e) {
  //       this._logger.error('Can not clear data create comment error', e);
  //     }
  //     next(err);
  //   }
  // }
  
  // async _validateCreateAnswer(req) {
  //   try {
  //     let validations = [
  //       body('text')
  //         .not().matches(/^(\s+|)$/).withMessage('Необхідно вказати текст'),
  //       param('articleId')
  //         .notEmpty().withMessage('Необхідно вказати статтю')
  //         .custom((value) => {
  //           let query = this._articleModel.findOne({ _id: value});
  //           return query.exec().then(article => {
  //             if (!article) {
  //               return Promise.reject('Статті не знайдено');
  //             }
  //           });
  //         }),
  //       param('commentId')
  //         .notEmpty().withMessage('Необхідно вказати коментар')
  //         .custom((value) => {
  //           let query = this._commentModel.findOne({ _id: value});
  //           return query.exec().then(article => {
  //             if (!article) {
  //               return Promise.reject('Коментаря не знайдено');
  //             }
  //           });
  //         })
  //     ];
  //     await this._validate(req, validations);
  //   } catch (err) {
  //     throw new ValidationError('Create answer error', err);
  //   }
  // }

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

  async _validate(req, validations) {
    await Promise.all(validations.map(validation => validation.run(req)));
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return;
    }
    throw errors;
  }
}
