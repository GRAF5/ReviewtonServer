'use strict';

import express from 'express';

export default class ContentRouter {

  /**
   * Constructs content router
   * @param {Object} param0 
   * @param {ContentService} contentService content service
   * @param {AuthorizationService} authorizationService authorization service
   */
  constructor({contentService, authorizationService}) {
    this._contentService = contentService;
    this._authorization = authorizationService;
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
   * /content/article/{id}:
   *    put:
   *      security:              
   *          - bearerAuth: []
   *      description: Update article
   *      parameters:
   *        - in: path
   *          name: id
   *          description: Article id
   *          required: true
   *          type: string
   *      requestBody: 
   *        required: true
   *        content:
   *          application/json:
   *            schema:
   *              type: object
   *              properties:
   *                rating:
   *                  description: Rating from 1 to 5
   *                  required: false
   *                  type: integer
   *                text:
   *                  description: Article text
   *                  required: false
   *                  type: string
   *      responses:
   *        200:
   *          description: Successful update article
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
   *        401:
   *          description: Unauthorized error
   * 
   * /content/comment/{id}:
   *    put:
   *      security:              
   *          - bearerAuth: []
   *      description: Update comment
   *      parameters:
   *        - in: path
   *          name: id
   *          description: Comment id
   *          required: true
   *          type: string
   *      requestBody: 
   *        required: true
   *        content:
   *          application/json:
   *            schema:
   *              type: object
   *              properties:
   *                text:
   *                  description: Article text
   *                  required: true
   *                  type: string
   *      responses:
   *        200:
   *          description: Successful update article
   *        400:
   *          description: Validation error
   *        401:
   *          description: Unauthorized error
   */
  router () {
    const router = express.Router();

    router.route('/content/articles')
      .get(this._contentService.getArticles.bind(this._contentService));

    router.route('/content/tags')
      .get(this._contentService.getTags.bind(this._contentService));

    router.route('/content/create/article')
      .post(this._authorization.authorize(),
        this._contentService.createArticle.bind(this._contentService));

    router.route('/content/article/:id')
      .put(this._authorization.authorize(),
        this._contentService.updateArticle.bind(this._contentService));

    router.route('/content/comments')
      .get(this._contentService.getComments.bind(this._contentService));
      
    router.route('/content/comment/:id')
      .put(this._authorization.authorize(),
        this._contentService.updateComment.bind(this._contentService));

    router.route('/content/create/comment')
      .post(this._authorization.authorize(),
        this._contentService.createComment.bind(this._contentService));

    return router;
  }
}
