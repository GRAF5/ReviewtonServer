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
      createTime: {type: Date, required: true},
      role: {type: String, enum: ['user', 'moderator', 'admin', 'super-admin'], default: 'user'},
      permissions: {type: [String], default: []},
      viewed: {type: Object, default: {}},
      reactions: {type: Object, default: {}},
      tagSubscriptions: [{type: Schema.Types.String, ref: 'Tag', default: []}],
      subjectSubscriptions: [{type: Schema.Types.String, ref: 'Subject', default: []}],
      userSubscriptions: [{type: Schema.Types.String, ref: 'User', default: []}]
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
    schema.statics.getUserById = getUserById;
    this._model = mongoose.model('User', schema);

    async function getAritcleReactions(articleId) {
      return await this.find({[`reactions.${articleId}`]: {$exists: true}}, 
        {reaction: `$reactions.${articleId}`}).lean();
    }

    async function updateUser(_id, data) {
      await this.updateOne({_id}, data);
    }

    async function getUserById(id) {
      let res = await this.aggregate([
        {
          $match: {_id: id}
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: 'userSubscriptions',
            as: 'subscribers'
          }
        },
        {
          $lookup: {
            from: 'articles',
            localField: '_id',
            foreignField: 'user',
            as: 'articleCount'
          }
        },
        {
          $addFields: {
            subscribers: {$size: '$subscribers'},
            articleCount: {$size: '$articleCount'}
          }
        }
      ]);
      await this.populate(res, {path: 'tagSubscriptions', select: '_id name'});
      await this.populate(res, {path: 'subjectSubscriptions', select: '_id name'});
      await this.populate(res, {path: 'userSubscriptions', select: '_id login'});
      return res[0] || null;
    }
  }

  get User() {
    return this._model;
  }
}
