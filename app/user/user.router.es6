'use strict';

import express from 'express';

export default class UserRouter {

  constructor({userController}) {
    this._userController = userController;
  }

  router() {
    const router = express.Router();

    router.route('/test')
      .get(this._userController.test.bind(this._userController));

    return router;
  }
}
