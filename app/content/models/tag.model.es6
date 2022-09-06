'use strict';

import mongoose from 'mongoose';

/**
 * Mongoose tag model
 */
export default class TagModel {

  constructor() {
    const fields = {
      _id: {type: String, required: true},
      name: {type: String, required: true}
    };
    const schema = new mongoose.Schema(fields);
    this._model = mongoose.model('Tag', schema);
  }

  get Tag() {
    return this._model;
  }
}
