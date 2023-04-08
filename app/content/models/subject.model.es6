'use strict';

import mongoose, { Schema } from 'mongoose';

/**
 * Mongoose subject model
 */
export default class SubjectModel {

  constructor() {
    const fields = {
      _id: {type: String, required: true},
      name: {type: String, required: true},
      rating: {type: Number}
    };
    const schema = new mongoose.Schema(fields, {versionKey: false});
    schema.statics.getWithFilter = getWithFilter;
    schema.statics.getById = getById;
    schema.statics.getSubjects = getSubjects;
    this._model = mongoose.model('Subject', schema);

    /**
     * Get subjects with filtering name
     * @param {String} filter filter to be included in name
     * @return {Array[String]} subject ids
     */
    async function getWithFilter(filter, limit = 1000, offset = 0) {
      let cond = {name: {$regex: filter}};
      return await this.getSubjects(cond, limit, offset);
    }
    
    async function getById(id) {
      let cond = {_id: id};
      let res = await this.getSubjects(cond, 1, 0);
      return res[0] || null;
    }

    async function getSubjects(cond, limit = 1000, offset = 0) {
      let res = await this.aggregate([
        {
          $match: cond
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: 'subjectSubscriptions',
            as: 'subscribers'
          }
        },
        {
          $lookup: {
            from: 'articles',
            localField: '_id',
            foreignField: 'subject',
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

  get Subject() {
    return this._model;
  }
}
