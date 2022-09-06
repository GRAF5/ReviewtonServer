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
      text: {type: String, required: true},
      createTime: {type: Date, required: true},
      user: {type: Schema.Types.String, ref: 'User', required: true},
      subject: {type: Schema.Types.String, ref: 'Subject', required: true}
    };
    const schema = new mongoose.Schema(fields);
    schema.statics.getAllOrBySubjectOrUser = getAllOrBySubjectOrUser;
    this._model = mongoose.model('Article', schema);

    async function getAllOrBySubjectOrUser(subjects, users, limit, offset) {
      let rules = [];
      if (subjects.length) {
        rules.push({subject: {$in: subjects}});
      }
      if (users.length) {
        rules.push({user: {$in: users}});
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
