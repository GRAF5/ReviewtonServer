'use strict';

import express from 'express';

export default class UserRouter {

  constructor({userService}) {
    this._userService = userService;
  }

  /**
   * @swagger
   * /test:
   *   get:
   *     description: Welcome to swagger-jsdoc!
   *     responses:
   *       200:
   *         description: Returns a mysterious string.
   */
  router() {
    const router = express.Router();
    router.route('/test')
      .get(this._userService.test.bind(this._userService));

    return router;
  }
}
