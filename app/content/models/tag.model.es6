'use strict';

import mongoose, { Schema } from 'mongoose';

/**
 * Mongoose tag model
 */
export default class TagModel {

  constructor() {
    const fields = {
      _id: {type: String, required: true},
      name: {type: String, required: true},
      articles: [{type: Schema.Types.String, ref: 'Article', default: []}]
    };
    const schema = new mongoose.Schema(fields, {versionKey: false});
    schema.statics.getTags = getTags;
    this._model = mongoose.model('Tag', schema);

    async function getTags(name, limit, offset) {
      return await this.find({ name: {$regex: name}})
        .sort('-articles')
        .skip(offset)
        .limit(limit)
        .populate()
        .lean();
    }
  }

  get Tag() {
    return this._model;
  }
}
