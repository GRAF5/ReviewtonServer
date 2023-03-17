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
    this._model = mongoose.model('Subject', schema);

    /**
     * Get subjects with filtering name
     * @param {String} filter filter to be included in name
     * @return {Array[String]} subject ids
     */
    async function getWithFilter(filter, limit = 1000, offset = 0) {
      let res = await mongoose.connection.models.Article.aggregate([
        {
          '$lookup': {
            'from': this.collection.name,
            'localField': 'subject',
            'foreignField': '_id',
            'as': 'subjects'
          }
        },
        {
          '$project': {
            '_id': 1,
            'name': 1,
            'subjects': {
              '$filter': {
                'input': '$subjects',
                'as': 'item',
                'cond': {
                  '$regexMatch': {
                    input: '$$item.name', 
                    regex: filter
                  }
                }
              }
            }
          }
        },
        {
          '$unwind': '$subjects'
        },
        {
          '$group': {
            '_id': '$subjects',
            'articleCount': {'$sum': 1}
          }
        }
      ])
        .sort('-articleCount')
        .skip(offset)
        .limit(limit);
      res = res.map(el => {return {...el._id, articleCount: el.articleCount};});
      return res;
    }
  }

  get Subject() {
    return this._model;
  }
}
