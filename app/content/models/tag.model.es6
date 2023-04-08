'use strict';

import mongoose, { Schema } from 'mongoose';

/**
 * Mongoose tag model
 */
export default class TagModel {

  constructor() {
    const fields = {
      _id: {type: String, required: true},
      name: {type: String, required: true}
    };
    const schema = new mongoose.Schema(fields, {versionKey: false});
    schema.statics.getTags = getTags;
    schema.statics.getById = getById;
    schema.statics._getTags = _getTags;
    this._model = mongoose.model('Tag', schema);
    
    async function getTags(filter, limit, offset) {
      let cond = {name: {$regex: filter}};
      return await this._getTags(cond, limit, offset);
    }

    async function getById(id) {
      let cond = {_id: id};
      let res = await this._getTags(cond, 1, 0);
      return res[0] || null;
    }

    async function _getTags(cond, limit, offset) {
      let res = await this.aggregate([
        {
          $match: cond
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: 'tagSubscriptions',
            as: 'subscribers'
          }
        },
        {
          $lookup: {
            from: 'articles',
            localField: '_id',
            foreignField: 'tags',
            as: 'articleCount'
          }
        },
        {
          $addFields: {
            subscribers: {$size: '$subscribers'},
            articleCount: {$size: '$articleCount'}
          }
        }
      ])
        .sort('-articleCount')
        .skip(offset)
        .limit(limit);
      return res;
    }
  }

  get Tag() {
    return this._model;
  }
}
