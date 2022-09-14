'use strict';

import express from 'express';

export default class UserRouter {

  constructor({userService}) {
    this._userService = userService;
  }

  /**
   * @swagger
   * 
   * /user/register:
   *    post:
   *      description: Regiser new user
   *      requestBody: 
   *        required: true
   *        content:
   *          application/json:
   *            schema:
   *              type: object
   *              properties:
   *                login:
   *                  description: User login
   *                  required: true
   *                  type: string
   *                email:
   *                  description: User email
   *                  required: true
   *                  type: string
   *                password:
   *                  type: string
   *                  description: User password
   *                  required: true
   *                passwordRepeat:
   *                  type: string
   *                  description: User repeated password
   *                  required: true
   *      responses:
   *        200:
   *          description: Successful register user
   *        400:
   *          description: Validation error
   * 
   * /user/authenticate:
   *    post:
   *      description: Authenticate user
   *      requestBody: 
   *        required: true
   *        content:
   *          application/json:
   *            schema:
   *              type: object
   *              properties:
   *                credentials:
   *                  description: Users login or emeil
   *                  required: true
   *                  type: string
   *                password:
   *                  type: string
   *                  description: User password
   *                  required: true
   *      responses:
   *        200:
   *          description: Successful authenticate user
   *        400:
   *          description: Validation error
   *        401:
   *          description: Unauthorized error
   * 
   * /user/view/article:
   *    put:
   *      description: Add viewed article to user
   *      requestBody: 
   *        required: true
   *        content:
   *          application/json:
   *            schema:
   *              type: object
   *              properties:
   *                user:
   *                  description: Users id
   *                  required: true
   *                  type: string
   *                articel:
   *                  type: string
   *                  description: Article id
   *                  required: true
   *      responses:
   *        200:
   *          description: Successful add viewed article
   *        400:
   *          description: Validation error
   */
  router() {
    const router = express.Router();

    router.route('/user/register')
      .post(this._userService.register.bind(this._userService));

    router.route('/user/authenticate')
      .post(this._userService.authenticate.bind(this._userService));

    router.route('/user/view/article')
      .put(this._userService.addViewed.bind(this._userService));

    return router;
  }
}
