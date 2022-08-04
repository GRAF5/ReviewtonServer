'use strict';

import log4js from 'log4js';

export default class UserController {

  constructor({config, userModel}) {
    this._config = config;
    this._userModel = userModel.User;
    this._logger = log4js.getLogger('UserController');
  }

  async test(req, res, next) {
    try {
      const user = new this._userModel({name: 'Test'});
      await user.save();
      return res.status(200).send(this._config);
    } catch (err) {
      this._logger.error('Error while test', err);
      next(err);
    }
  }
}
