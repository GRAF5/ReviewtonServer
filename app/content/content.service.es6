'use strict';

import log4js from 'log4js';

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
