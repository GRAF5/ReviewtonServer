'use strict';

import express from 'express';

export default class AuthorizationRouter {

  constructor({authorizationService}) {
    this._authorizationService = authorizationService;
  }

  /**
   * @swagger
   * 
   * /authorization/current:
   *    get:
   *      description: Get user by token
   *      responses:
   *        200:
   *          description: Successful authenticate user
   *        400:
   *          description: Bad request
   *        404:
   *          description: User not found
   *        
   */
  router() {
    const router = express.Router();

    router.route('/authorization/current')
      .get(this._authorizationService.current.bind(this._authorizationService));

    return router;
  }
}
