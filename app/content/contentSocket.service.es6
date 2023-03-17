'use strict';

import log4js from 'log4js';
import _ from 'lodash';
import {v4} from 'uuid';

export default class ContentSocketService {

  constructor({config, authorizationService, websocket, articleModel, commentModel, userModel}) {
    this._config = config;
    this._authorizationService = authorizationService;
    this._websocket = websocket;
    this._articleModel = articleModel.Article;
    this._commentModel = commentModel.Comment;
    this._userModel = userModel.User;
    this._nsps = {};
    this._intervals = {};
    this._contexts = {};
    this._route = '/';
    this._logger = log4js.getLogger('ContentSocketService');
  }

  start() {
    this._articleFeedNsp = this._websocket.subscribe(this._route, [
      {event: 'article-feed:subscribe', listeners: [
        this._authorizationService.wsAuthorize(),
        this.articleFeedSubscribe.bind(this)]},
      {event: 'article-feed:subscribe-comments', listeners: [this.articleFeedSubscribeComments.bind(this)]},
      {event: 'article-feed:unsubscribe-comments', listeners: [this.articleFeedUnsubscribeComments.bind(this)]},
      {event: 'article-feed:estimate-article', listeners: [
        this._authorizationService.wsAuthorize('estimate-article'),
        this.articleFeedEstimateArticle.bind(this)]},
      {event: 'article-feed:upsert-comment', listeners: [
        this._authorizationService.wsAuthorize('create-comment'),
        this.articleFeedUpsertComment.bind(this)
      ]},
      {event: 'disconnect', listeners: [this.disconnect.bind(this)]},
      {event: 'article-feed:unsubscribe', listeners: [this.articleFeedUnsubscribe.bind(this)]}
    ]);
  }

  stop() {
    for (let socketId of Object.keys(this._intervals)) {
      for (let id of Object.keys(this._intervals[socketId])) {
        clearInterval(this._intervals[socketId][id]);
      }
      delete this._intervals[socketId];
    }
    this._contexts = {};
    this._websocket.unsubscribe(this._articleFeedNsp);
  }

  _getId() {
    return v4();
  }

  disconnect(context, next) {
    try {
      const {socketId, route, data, user} = context;
      this._disconnect(socketId);
      next();
    } catch (err) {
      this._logger.error(`Failed to disconnect ${context.socketId}`, err);
      next(err);
    }
  }

  _disconnect(socketId) {
    if (this._intervals[socketId]) {
      for (let id of Object.keys(this._intervals[socketId])) {
        clearInterval(this._intervals[socketId][id]);
      }
      delete this._intervals[socketId];
    }
    delete this._contexts[socketId];
  }

  articleFeedUnsubscribe(context, next) {
    try {
      const {socketId, route, data, user} = context;
      if (this._intervals[socketId]) {
        clearInterval(this._intervals[socketId][data.article]);
        delete this._intervals[socketId][data.article];
      }
      if (this._contexts[socketId]) {
        delete this._contexts[socketId][data.article];
      }
      next();
    } catch (err) {
      this._logger.error(`Failed to article-feed:unsubscribe ${context.socketId}`, err);
      next(err);
    }
  }

  async articleFeedSubscribe(context, next) {
    try {
      const {socketId, route, data, user} = context;
      this._contexts[socketId] = _.defaultTo(this._contexts[socketId] || {});
      this._intervals[socketId] = _.defaultTo(this._intervals[socketId] || {});
      this._contexts[socketId][data.article] = {
        userId: user?._id,
        getComments: data.commentsRender || false
      };
      this._intervals[socketId][data.article] = process.env.NODE_ENV !== 'test' ? 
        setInterval(this._articleFeedJob.bind(this), 
          _.defaultTo(this._config.websocket.intarvalInSeconds, 60) * 1000, socketId, data.article) :
        [socketId, data.article];
      await this._articleFeedJob(socketId, data.article);
      next();
    } catch (err) {
      this._logger.error(`Failed to article-feed:subscribe ${context.socketId}`, err);
      next(err);
    }
  }

  async articleFeedSubscribeComments(context, next) {
    try {
      const {socketId, route, data, user} = context;
      this._contexts[socketId][data.article].getComments = true;
      await this._articleFeedJob(socketId, data.article);
      next();
    } catch (err) {
      this._logger.error(`Failed to article-feed:subscribe-comments ${context.socketId}`, err);
      next(err);
    }
  }

  articleFeedUnsubscribeComments(context, next) {
    try {
      const {socketId, route, data, user} = context;
      this._contexts[socketId][data.article].getComments = false;
      next();
    } catch (err) {
      this._logger.error(`Failed to article-feed:unsubscribe-comments ${context.socketId}`, err);
      next(err);
    }
  }

  async articleFeedEstimateArticle(context, next) {
    try {
      const {socketId, route, data, user} = context;
      let userdoc = await this._userModel.findById(user._id).lean();
      if (data.reaction !== undefined) {
        userdoc.reactions = _.defaultTo(user.reactions, {});
        userdoc.reactions[data.article] = data.reaction;
      } else {
        delete userdoc.reactions[data.article];
      }
      await this._userModel.updateUser(user._id, {reactions: userdoc.reactions});
      await this._articleFeedJob(socketId, data.article);
      next();
    } catch (err) {
      this._logger.error(`Failed to estimate article ${context.socketId}`, err);
      next(err);
    }
  }

  async articleFeedUpsertComment(context, next) {
    try {
      const {socketId, route, data, user} = context;
      let id = _.defaultTo(data._id, this._getId());
      let comment = _.defaultTo(await this._commentModel.findById(data._id).lean(),{
        text: data.text,
        user: user._id,
        article: data.article,
        createTime: Date.now()
      });
      comment.text = data.text;
      comment.comment = data.comment;
      await this._commentModel.updateOne({_id: id}, {$set: comment}, {upsert: true});
      await this._articleFeedJob(socketId, data.article);
      next();
    } catch (err) {
      this._logger.error('Failed to create comment', err);
      this._logger.error(`Failed to create comment ${context.socketId}`, err);
      next(err);
    }
  }

  async _articleFeedJob(socketId, articleId) {
    try {
      const {
        userId,
        getComments = false
      } = this._contexts[socketId][articleId];
      let article = await this._articleModel.getArticle(articleId);
      let reactions = await this._userModel.getAritcleReactions(articleId);
      let likes = 0, dislikes = 0;
      reactions.forEach(user => {
        if (user.reaction) {
          likes++;
        } else {
          dislikes++;
        }
        if (user._id === userId) {
          article.userReaction = user.reaction;
        }
      });
      article.likes = likes;
      article.dislikes = dislikes;
      if (getComments) {
        let comments = await this._commentModel.find({article: articleId})
          .sort('createTime')
          .populate('user', ['login'])
          .lean();
        for (let comment of comments) {
          let replyCount = await this._commentModel.find({comment: comment._id}).count();
          comment.replyCount = replyCount;
        }
        article.comments = comments;
      }
      this._websocket.emit(this._articleFeedNsp, socketId, `article-update-${articleId}`, article);
    } catch (err) {
      this._logger.error(`Failed send article ${articleId} to ${socketId} ${this._intervals[socketId]}`, err);
      this._websocket.disconnect(socketId);
      this._disconnect(socketId);
      console.log(this._contexts);
    }
  }
}
