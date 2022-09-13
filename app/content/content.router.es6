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
   * 
   * /content/create/article:
   *    post:
   *      security:              
   *          - bearerAuth: []
   *      description: Create new article
   *      requestBody: 
   *        required: true
   *        content:
   *          application/json:
   *            schema:
   *              type: object
   *              properties:
   *                user:
   *                  type: string
   *                  description: User id
   *                  required: true
   *                subject:
   *                  type: string
   *                  description: Subject title
   *                  required: true
   *                rating:
   *                  description: Rating from 1 to 5
   *                  required: true
   *                  type: integer
   *                text:
   *                  description: Article text
   *                  required: false
   *                  type: string
   *                tags:
   *                  description: Array of tags title
   *                  required: false
   *                  type: array
   *                  items: 
   *                    type: string
   *      responses:
   *        200:
   *          description: Successful create article
   *        400:
   *          description: Validation error
   * 
   * /content/comment:
   *    post:
   *      security:              
   *          - bearerAuth: []
   *      description: Create new comment
   *      requestBody: 
   *        required: true
   *        content:
   *          application/json:
   *            schema:
   *              type: object
   *              properties:
   *                user:
   *                  type: string
   *                  description: User id
   *                  required: true
   *                text:
   *                  type: string
   *                  description: Comment text
   *                  required: true
   *                article:
   *                  description: Article id
   *                  required: true
   *                  type: string
   *      responses:
   *        200:
   *          description: Successful create comment
   *        400:
   *          description: Validation error
   */
  router () {
    const router = express.Router();

    router.route('/content/articles')
      .get(this._contentService.getArticles.bind(this._contentService));

    router.route('/content/tags')
      .get(this._contentService.getTags.bind(this._contentService));

    router.route('/content/create/article')
      .post(this._contentService.createArticle.bind(this._contentService));

    router.route('/content/comments')
      .get(this._contentService.getComments.bind(this._contentService));

    router.route('/content/create/comment')
      .post(this._contentService.createComment.bind(this._contentService));

    return router;
  }
}
