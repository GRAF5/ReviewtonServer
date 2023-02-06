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
    this._model = mongoose.model('Tag', schema);

    async function getTags(name, limit, offset) {
      let res = await mongoose.connection.models.Article.aggregate([
        {
          '$lookup': {
            'from': this.collection.name,
            'localField': 'tags',
            'foreignField': '_id',
            'as': 'tags'
          }
        },
        {
          '$project': {
            '_id': 1,
            'name': 1,
            'tags': {
              '$filter': {
                'input': '$tags',
                'as': 'item',
                'cond': {
                  '$regexMatch': {
                    input: '$$item.name', 
                    regex: name
                  }
                }
              }
            }
          }
        },
        {
          '$unwind': '$tags'
        },
        {
          '$group': {
            '_id': '$tags',
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

  get Tag() {
    return this._model;
  }
}
