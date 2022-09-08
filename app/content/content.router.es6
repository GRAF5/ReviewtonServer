'use strict';

import express from 'express';

export default class ContentRouter {

  constructor({contentService}) {
    this._contentService = contentService;
  }

  /**
   * @swagger
   * 
   * /content/articles:
   *    get:
   *      description: Get articles ordered by create time
   *      parameters: 
   *        - name: name
   *          description: name
   *          required: false
   *          in: query
   *          type: string
   *        - name: limit
   *          description: Pagination limit
   *          required: false
   *          in: query
   *          type: integer
   *        - name: offset
   *          description: Pagination offset
   *          required: false
   *          in: query
   *          type: integer
   *      responses:
   *        200:
   *          description: Successful get articles
   * 
   * /content/tags:
   *    get:
   *      description: Get tags ordered by articles count
   *      parameters: 
   *        - name: name
   *          description: name
   *          required: false
   *          in: query
   *          type: string
   *        - name: limit
   *          description: Pagination limit
   *          required: false
   *          in: query
   *          type: integer
   *        - name: offset
   *          description: Pagination offset
   *          required: false
   *          in: query
   *          type: integer
   *      responses:
   *        200:
   *          description: Successful get articles
   */
  router () {
    const router = express.Router();

    router.route('/content/articles')
      .get(this._contentService.getArticles.bind(this._contentService));

    router.route('/content/tags')
      .get(this._contentService.getTags.bind(this._contentService));

    return router;
  }
}
