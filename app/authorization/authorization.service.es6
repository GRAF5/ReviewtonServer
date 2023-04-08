'use strict';

import log4js from 'log4js';
import jwt from 'jsonwebtoken';
import { NotFoundError } from '../errorHandler/errorHandler.es6';
import { BadRequestError } from '../errorHandler/errorHandler.es6';
import { ForbiddenError } from '../errorHandler/errorHandler.es6';

export default class AuthorizationService {

  constructor({config, userModel}) {
    this._config = config;
    this._userModel = userModel.User;
    this._logger = log4js.getLogger('AuthorizationService');
  }

  /**
   * Authenticate user by token
   */
  async current(req, res, next) {
    try {
      const {token, user} = await this._checkToken(req.headers.authorization);
      res.status(200).json({
        token,
        id: user._id,
        login: user.login,
        email: user.email,
        role: user.role,
        tagSubscriptions: user.tagSubscriptions,
        subjectSubscriptions: user.subjectSubscriptions,
        userSubscriptions: user.userSubscriptions
      });
    } catch (err) {
      this._logger.error('Error getting current user', err);
      next(err);
    }
  }

  /**
   * Authorization middleware. Set user data to res.locals.user
   * @param {String} method method to require
   * @returns {Function(req, res, next)} Authorization middleware
   */
  authorize(method, isRequired) {
    return async (req, res, next) => {
      isRequired = isRequired || method ? true : false;
      try {
        const {token, user} = await this._checkToken(req.headers.authorization, isRequired);
        this._requireMethodAccess(method, user?.permissions);
        res.locals.user = user;
        next();
      } catch (err) {
        next(err);
      }
    };
  }

  wsAuthorize(method) {
    return async (context, next) => {
      try {
        let isRequired = method ? true : false;
        const {token, user} = await this._checkToken(context.data.authorization, isRequired);
        this._requireMethodAccess(method, user?.permissions);
        context.user = user;
        next();
      } catch (err) {
        this._logger.error('Failed authorize WS', err);
        next(err);
      }
    };
  }

  _requireMethodAccess(method, permissions) {
    if (!method) {
      return;
    }
    if (!permissions.find(el => el === method)) {
      throw new ForbiddenError(`You do not have access to ${method} method`);
    }
  }

  async _checkToken(authorization, isRequired = true) {
    try {
      const [type, token] = (authorization || '').split(' ');
      if (type !== 'Bearer') {
        throw new BadRequestError('Wrong authorization type');
      }
      const data = jwt.decode(token, {json: true});
      if (data.exp * 1000 <= Date.now()) {
        throw new BadRequestError('Token expired');
      }
      if (!data.sub) {
        throw new BadRequestError('Wrong id');
      }
      const user = await this._userModel.getUserById(data.sub);
      if (!user) {
        throw new NotFoundError(`User with id ${data.sub} not found`);
      }
      return {token, user};
    } catch (err) {
      if (isRequired) {
        throw err;
      } else {
        return {};
      }
    }
  }
}
