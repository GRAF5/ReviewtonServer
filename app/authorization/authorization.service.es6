'use strict';

import log4js from 'log4js';
import jwt from 'jsonwebtoken';
import { NotFoundError, BadRequestError, ForbiddenError, UnauthorizedError } from '../errorHandler/errorHandler.es6';
import argon2 from 'argon2';
import crypto from 'crypto';

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
      return this._send(res, 200, {
        token,
        _id: user._id,
        login: user.login,
        email: user.email,
        role: user.role,
        description: user.description,
        tagSubscriptions: user.tagSubscriptions,
        subjectSubscriptions: user.subjectSubscriptions,
        userSubscriptions: user.userSubscriptions});
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

  /**
   * Authorization middleware for websocket
   * @param {String} method method to require
   * @returns {Function(context, next)} Authorization middleware
   */
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

  // eslint-disable-next-line complexity
  async _checkToken(authorization, isRequired = true) {
    try {
      const [type, token] = (authorization || '').split(' ');
      if (type !== 'Bearer') {
        throw new BadRequestError('Wrong authorization type');
      }
      let data; 
      try {
        data = jwt.decode(token, {json: true});
      } catch {
        throw new BadRequestError('Wrong authorization type');
      }
      try {
        if (data.exp * 1000 <= Date.now()) {
          throw 'Token expired';
        }
      } catch {
        throw new BadRequestError('Token expired');
      }
      if (!data.sub) {
        throw new BadRequestError('Wrong id');
      }
      const user = await this._userModel.getUserByIdOrCredentials(data.sub);
      if (!user) {
        throw new NotFoundError(`User with id ${data.sub} not found`);
      }
      try {
        let hash = crypto.createHmac('sha512', user.salt).update(`${user.login}${user.hash}`).digest('hex');
        if (data.token !== hash) {
          throw 'Unathorized';
        }
      } catch {
        throw new UnauthorizedError('Unathorized');
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

  async createJWT(id) {
    const user = await this._userModel.findById(id);
    const token = crypto.createHmac('sha512', user.salt).update(`${user.login}${user.hash}`).digest('hex');
    //(await argon2.hash(`${user.login}${user.hash}`));
    return jwt.sign({sub: id, token}, this._config.secret, { expiresIn: '7d'});
  }
  
  _send(res, status, data = {}, age = 5) {
    return res.set('Cache-Control', `public, max-age=${age}`).status(status).json(data);
  }
}
