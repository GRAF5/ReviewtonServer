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
   *      parameters:
   *        - name: login
   *          description: Users login
   *          required: true
   *          in: body
   *          type: string
   *        - name: email
   *          description: Usersemail
   *          required: true
   *          in: body
   *          type: string
   *        - name: password
   *          description: User password
   *          required: true
   *          in: body
   *          type: string
   *        - name: passwordRepeat
   *          description: User repeated password
   *          required: true
   *          in: body
   *          type: string
   *      responses:
   *        200:
   *          description: Successful register user
   *        400:
   *          description: Validation error
   * 
   * /user/authenticate:
   *    post:
   *      description: Authenticate user
   *      parameters:
   *        - name: credentials
   *          description: Users login or emeil
   *          required: true
   *          in: body
   *          type: string
   *        - name: password
   *          description: User password
   *          required: true
   *          in: body
   *          type: string
   *      responses:
   *        200:
   *          description: Successful authenticate user
   *        400:
   *          description: Validation error
   *        401:
   *          description: Unauthorized error
   */
  router() {
    const router = express.Router();

    router.route('/user/register')
      .post(this._userService.register.bind(this._userService));

    router.route('/user/authenticate')
      .post(this._userService.authenticate.bind(this._userService));

    return router;
  }
}
