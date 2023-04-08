'use strict';

import express from 'express';

export default class UserRouter {

  /**
   * Constructs user router
   * @param {Object} param0 
   * @param {UserService} userService user service
   * @param {AuthorizationService} authorizationService authorization service
   */
  constructor({userService, authorizationService}) {
    this._userService = userService;
    this._authorization = authorizationService;
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
   * /user/{id}/viewed:
   *    put:
   *      security:              
   *          - bearerAuth: []
   *      description: Add viewed article to user
   *      requestBody: 
   *        required: true
   *        content:
   *          application/json:
   *            schema:
   *              type: object
   *              properties:
   *                article:
   *                  type: string
   *                  description: Article id
   *                  required: true
   *      parameters:
   *        - in: path
   *          name: id
   *          description: User id
   *          required: true
   *          type: string
   *      responses:
   *        200:
   *          description: Successful add viewed article
   *        400:
   *          description: Validation error
   *    get:
   *      security:              
   *          - bearerAuth: []
   *      description: Get user viewed articles
   *      parameters:
   *        - in: path
   *          name: id
   *          description: User id
   *          required: true
   *          type: string
   *      responses:
   *        200:
   *          description: Successful get user viewed articles
   *        400:
   *          description: Validation error
   * 
   * 
   */
  router() {
    const router = express.Router();

    router.route('/user/register')
      .post(this._userService.register.bind(this._userService));

    router.route('/user/authenticate')
      .post(this._userService.authenticate.bind(this._userService));

    router.route('/user/:userId')
      .get(this._userService.getUserById.bind(this._userService));
    
    router.route('/user/current/subscriptions/tags/:subscriptionId')
      .put(this._authorization.authorize(undefined, true),
        this._userService.addTagSubscription.bind(this._userService))
      .delete(this._authorization.authorize(undefined, true),
        this._userService.removeTagSubscription.bind(this._userService));
    
    router.route('/user/current/subscriptions/subjects/:subscriptionId')
      .put(this._authorization.authorize(undefined, true),
        this._userService.addSubjectSubscription.bind(this._userService))
      .delete(this._authorization.authorize(undefined, true),
        this._userService.removeSubjectSubscription.bind(this._userService));
    
    router.route('/user/current/subscriptions/users/:subscriptionId')
      .put(this._authorization.authorize(undefined, true),
        this._userService.addUserSubscription.bind(this._userService))
      .delete(this._authorization.authorize(undefined, true),
        this._userService.removeUserSubscription.bind(this._userService));
    // router.route('/user/:id/viewed')
    //   .get(this._authorization.authorize(),
    //     this._userService.getViewed.bind(this._userService))
    //   .put(this._authorization.authorize(),
    //     this._userService.addViewed.bind(this._userService));

    return router;
  }
}
