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
      comments: [{type: Schema.Types.String, ref: 'Comment', default: []}],
      views: {type: Number, default: 0}
    };
    const schema = new mongoose.Schema(fields, {versionKey: false});
    schema.statics.getAllOrBySubjectOrUserOrTags = getAllOrBySubjectOrUserOrTags;
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
    async function getAllOrBySubjectOrUserOrTags(subjects, users, tags, limit, offset) {
      let rules = [];
      if (subjects.length) {
        rules.push({subject: {$in: subjects}});
      }
      if (users.length) {
        rules.push({user: {$in: users}});
      }
      if (tags.length) {
        rules.push({tags});
      }
      let filter = rules.length ? {$or: rules} : {};
      return await this.find(filter)
        .sort('-createTime')
        .skip(offset)
        .limit(limit)
        .populate()
        .lean();
    }
  }

  get Article() {
    return this._model;
  }
}
