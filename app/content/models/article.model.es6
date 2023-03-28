'use strict';

import mongoose, { Schema } from 'mongoose';

/**
 * Mongoose article model
 */
export default class ArticleModel {

  constructor() {
    const fields = {
      _id: {type: String, required: true},
      rating: {type: Number, required: true},
      text: {type: String},
      createTime: {type: Date, required: true},
      user: {type: Schema.Types.String, ref: 'User', required: true},
      subject: {type: Schema.Types.String, ref: 'Subject', required: true},
      tags: [{type: Schema.Types.String, ref: 'Tag', default: []}],
      views: {type: Number, default: 0},
      images: {}
      // likes: {type: Number, default: 0},
      // dislikes: {type: Number, default: 0}
    };
    const schema = new mongoose.Schema(fields, {versionKey: false});
    schema.statics.getAllOrBySubjectOrUserOrTags = getAllOrBySubjectOrUserOrTags;
    schema.statics.getArticle = getArticle;
    schema.statics.getArticles = getArticles;
    this._model = mongoose.model('Article', schema);

    /**
     * Get all articles or by subjects or users or tags
     * @param {Array<String>} subjects array of subjects id
     * @param {Array<String>} users array of users id
     * @param {Array<String>} tags array of tags id
     * @param {Number} limit pagination limit 
     * @param {Number} offset pagination offset
     * @returns 
     */
    async function getAllOrBySubjectOrUserOrTags(subjects, users, tags, empty, limit, offset) {
      let rules = [];
      if (subjects.length) {
        rules.push({subject: {$in: subjects.map(s => s._id)}});
      }
      if (users.length) {
        rules.push({user: {$in: users.map(u => u._id)}});
      }
      if (tags.length) {
        rules.push({tags: {$elemMatch: {$in: tags.map(t => t._id)}}});
      }
      let filter = rules.length ? {$or: rules} : {};
      if (!empty) {
        filter = Object.assign({}, {text: {$exists : true, $ne : ''}}, filter);
      }
      return await this.getArticles(filter, {createTime: -1}, limit, offset);
      // return await this.find(filter)
      //   .sort('-createTime')
      //   .skip(offset)
      //   .limit(limit)
      //   .populate('user', '_id login')
      //   .populate('tags', '_id name')
      //   .populate('subject', '_id name')
      //   .lean();
    }

    async function getArticle(id) {
      let filter = {_id: id};
      let res = await this.getArticles(filter, {createTime: -1});
      return res[0] || null;
    }

    async function getArticles(filter, sort, limit = 1, offset = 0) {
      let articles = await this.aggregate([
        {
          $match: filter
        },
        {
          $lookup: {
            from: 'comments',
            localField: '_id',
            foreignField: 'article',
            as: 'commentsCount'
          }
        },
        {
          $addFields: {
            commentsCount: {$size: '$commentsCount'}
          }
        },
        {$sort: sort},
        {$skip: offset},
        {$limit: limit}
      ]);
      await this.populate(articles, {path: 'user', select: '_id login'});
      await this.populate(articles, {path: 'tags', select: '_id name'});
      await this.populate(articles, {path: 'subject', select: '_id name'});
      return articles;
    }
  }

  get Article() {
    return this._model;
  }
}
