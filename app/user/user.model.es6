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
      role: {type: String, enum: ['user', 'moderator', 'admin', 'super-admin'], default: 'user'},
      permissions: {type: [String], default: []},
      viewed: {type: Object, default: {}},
      reactions: {type: Object, default: {}}
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
    schema.statics.getAritcleReactions = getAritcleReactions;
    schema.statics.updateUser = updateUser;
    this._model = mongoose.model('User', schema);

    async function getAritcleReactions(articleId) {
      return await this.find({[`reactions.${articleId}`]: {$exists: true}}, 
        {reaction: `$reactions.${articleId}`}).lean();
    }

    async function updateUser(_id, data) {
      await this.updateOne({_id}, data);
    }
  }

  get User() {
    return this._model;
  }
}
