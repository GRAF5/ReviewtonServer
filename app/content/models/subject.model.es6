'use strict';

import _ from 'lodash';
import mongoose, { Schema } from "mongoose";
import { v4 } from 'uuid';

/**
 * Mongoose subject model
 */
export default class SubjectModel {

  constructor() {
    const fields = {
      _id: {type: String, required: true},
      name: {type: String, required: true},
      rating: {type: Number},
      articles: [{type: Schema.Types.String, ref: 'Article'}],
      tags: [{type: Schema.Types.String, ref: 'Tag'}]
    };
    const schema = new mongoose.Schema(fields);
    schema.statics.getIdsByNameContain = getIdsByNameContain;
    this._model = mongoose.model('Subject', schema);

    /**
     * Get subjects by name or tags
     * @param {String} text text to be included in name
     * @param {Array[String]} tags tags id
     * @return {Array[String]} subject ids
     */
    async function getIdsByNameContain(text, tags) {
      let rules = [{ name: {$regex: text} }];
      if (tags.length) {
        rules.push({tags});
      }
      return await this.find()
        .or(rules)
        .select('_id');
    }
  }

  get Subject() {
    return this._model;
  }
}
