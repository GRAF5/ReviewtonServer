'use strict';

import mongoose from 'mongoose';

export default class UserModel {

  constructor() {
    const fields = {
      name: {type: String, required: true}
    };
    const schema = new mongoose.Schema(fields);
    this._model = mongoose.model('User', schema);
  }

  get User() {
    return this._model;
  }
}
