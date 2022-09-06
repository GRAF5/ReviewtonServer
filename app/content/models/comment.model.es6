'use strict';

import mongoose, { Schema } from 'mongoose';

/**
 * Mongoose comment model
 */
export default class CommentModel {

  constructor() {
    const fields = {
      _id: {type: String, required: true},
      text: {type: String, required: true},
      createTime: {type: Date, required: true},
      userId: {type: Schema.Types.String, required: true}
    };
    const schema = new mongoose.Schema(fields);
    this._model = mongoose.model('Comment', schema);
  }

  get Comment() {
    return this._model;
  }
}
