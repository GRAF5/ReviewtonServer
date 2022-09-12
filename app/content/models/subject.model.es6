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
      rating: {type: Number},
      articles: [{type: Schema.Types.String, ref: 'Article', default: []}]
    };
    const schema = new mongoose.Schema(fields);
    schema.statics.getIdsByName = getIdsByName;
    this._model = mongoose.model('Subject', schema);

    /**
     * Get subjects by name or tags
     * @param {String} text text to be included in name
     * @return {Array[String]} subject ids
     */
    async function getIdsByName(text) {
      let rules = [{ name: {$regex: text} }];
      return this.find()
        .or(rules)
        .select('_id');
    }
  }

  get Subject() {
    return this._model;
  }
}
