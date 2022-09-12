'use strict';

import mongoose, { Schema } from 'mongoose';
import crypto from 'crypto';

/**
 * Mongoose user model
 */
export default class UserModel {

  constructor() {
    const fields = {
      _id: {type: String, required: true},
      login: {type: String, required: true},
      email: {type: String, required: true},
      hash: {type: String, required: true},
      salt: {type: String, required: true},
      articles: [{type: Schema.Types.String, ref: 'Article', default: []}],
      comments: [{type: Schema.Types.String, ref: 'Comment', default: []}]
    };
    const schema = new mongoose.Schema(fields, {versionKey: false});
    schema.set('validateBeforeSave', false);
    schema.statics.createHash = function(password) {
      return new Promise((res, rej) => {
        let salt = crypto.randomBytes(16).toString('hex');
        let hash;
        crypto.scrypt(password, salt, 64, (err, key) => {
          if (err) {
            rej(err);
          }
          hash = key.toString('hex');
          res({salt, hash});
        });
      });
    };
    schema.statics.verify = function(password, salt, hash) {
      return new Promise((res, rej) => {
        const key = Buffer.from(hash, 'hex');
        crypto.scrypt(password, salt, 64, (err, derivedKey) => {
          if (err) {
            rej(err);
          }
          res(crypto.timingSafeEqual(key, derivedKey)); 
        });
      });
    };
    this._model = mongoose.model('User', schema);
  }

  get User() {
    return this._model;
  }
}
