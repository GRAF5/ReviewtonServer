'use strict';

import { body, check, param, validationResult } from 'express-validator';
import log4js from 'log4js';
import { v4 } from 'uuid';
import _ from 'lodash';
import { 
  UnauthorizedError,
  ValidationError,
  NotFoundError } from '../errorHandler/errorHandler.es6';

/**
 * Class for users requests
 */
export default class UserService {

  /**
   * User service constructor
   * @param param0 
   * @param {Config} param0.config server config
   * @param {UserModel} param0.userModel user model
   * @param {SubjectModel} param0.subjectModel subject model
   * @param {TagModel} param0.tagModel tag model
   */
  constructor({config, userModel, subjectModel, tagModel, authorizationService}) {
    this._config = config;
    this._userModel = userModel.User;
    this._subjectModel = subjectModel.Subject;
    this._tagModel = tagModel.Tag;
    this._authorizationService = authorizationService;
    this._logger = log4js.getLogger('UserService');
  }

  /**
   * Register new user
   */
  async register(req, res, next) {
    try {
      await this._validateRegister(req);
      const {salt, hash} = await this._userModel.createHash(req.body.password);
      const _id = v4();
      const permissions = [
        'create-article',
        'update-article',
        'estimate-article',
        'create-comment',
        'update-comment'
      ];
      let user = new this._userModel({
        ...req.body, 
        salt, 
        hash, 
        _id, 
        permissions,
        createTime: new Date()
      });
      await user.save();
      return this._send(res, 200, {_id});
    } catch (err) {
      this._logger.error('Error while register', err);
      next(err);
    }
  }

  async _validateRegister(req) {
    try {
      let validations = [
        body('login')
          .notEmpty().withMessage('Необхідно вказати ім\'я користувача')
          .isLength({min: 4, max: 20}).withMessage('Має містити принаймні 4 символи')
          .matches(/^[a-zA-Z0-9_]*$/).withMessage('Дозволено тільки латинські букви та цифри')
          .custom((value) => {
            let query = this._userModel.findOne({ login: {$regex: new RegExp(`^${value}$`, 'i')}});
            return query.exec().then(user => {
              if (user) {
                return Promise.reject('Вказане ім\'я користувача вже зайнято');
              }
            });
          }),
        body('email')
          .notEmpty().withMessage('Необхідно вказати пошту')
          .isEmail().withMessage('Має бути поштою')
          .custom((value) => {
            let query = this._userModel.findOne({ email: value});
            return query.exec().then(user => {
              if (user) {
                return Promise.reject('Акаунт із вказаною поштою вже існує');
              }
            });
          }),
        body('password')
          .notEmpty().withMessage('Необхідно вказати пароль')
          .matches(/(?=.*\d)/).withMessage('Пароль має містити хоч одну цифру')
          .matches(/(?=.*[a-z])/).withMessage('Пароль має містити хоч одну малу латинську літеру')
          .matches(/(?=.*[A-Z])/).withMessage('Пароль має містити хоч одну велику латинську літеру')
          .isLength({min: 8}).withMessage('Пароль має містити принаймні 8 символів'),
        body('passwordRepeat')
          .notEmpty().withMessage('Необхідно підтвердити пароль')
          .equals(req.body.password).withMessage('Паролі повинні співпадати')
      ];
      await this._validate(req, validations);
    } catch (err) {
      throw new ValidationError('Register error', err);
    }
  }

  /**
   * Authenticate user
   */
  async authenticate(req, res, next) {
    try {   
      await this._validateAuthenticate(req);
      const user = await this._userModel.getUserByIdOrCredentials(req.body.credentials);
      if (user && await this._userModel.verify(req.body.password, user.salt, user.hash)) {
        const token = await this._authorizationService.createJWT(user._id);
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
      } else {
        throw new UnauthorizedError('Невірний логін або пароль');
      }
    } catch (err) {
      this._logger.error('Error while authenticate', err);
      next(err);
    }
  }
  
  async _validateAuthenticate(req) {
    try {
      let validations = [
        body('credentials')
          .notEmpty().withMessage('Необхідно вказати ім\'я користувача або пошту'),
        body('password')
          .notEmpty().withMessage('Необхідно вказати пароль')
      ];
      await this._validate(req, validations);
    } catch (err) {
      throw new ValidationError('Authenticate error', err);
    }
  }

  async getUserById(req, res, next) {
    try {
      const userId = req.params.userId;
      const user = await this._userModel.getUserByIdOrCredentials(userId);
      if (!user) {
        throw new NotFoundError(`Не знайдено користувача ${userId}`);
      }
      return this._send(res, 200, {
        _id: user._id,
        login: user.login,
        description: user.description,
        articleCount: user.articleCount,
        subscribers: user.subscribers});
    } catch (err) {
      this._logger.error('Error to get user', err);
      next(err);
    }
  }

  async addTagSubscription(req, res, next) {
    try {
      const userId = res.locals.user._id;
      const subscriptionId = req.params.subscriptionId;
      let tag = await this._tagModel.getById(subscriptionId);
      if (!tag) {
        throw new NotFoundError(`Not found tag with id ${subscriptionId}`);
      }
      res.locals.user.tagSubscriptions.push({_id: subscriptionId, name: tag.name});
      res.locals.user.subjectSubscriptions = _.uniqBy(res.locals.user.subjectSubscriptions, '_id');
      await this._userModel.updateUser(userId, {
        tagSubscriptions: res.locals.user.tagSubscriptions});
      return this._send(res, 200, {tagSubscriptions: res.locals.user.tagSubscriptions});
    } catch (err) {
      this._logger.error('Error to add user subscribtion', err);
      next(err);
    }
  }

  async removeTagSubscription(req, res, next) {
    try {
      const userId = res.locals.user._id;
      const subscriptionId = req.params.subscriptionId;
      const tagSubscriptions = (res.locals.user.tagSubscriptions || []).filter(sub => sub._id !== subscriptionId);
      await this._userModel.updateUser(userId, {tagSubscriptions});
      return this._send(res, 200, {tagSubscriptions});
    } catch (err) {
      this._logger.error('Error to remove user subscribtion', err);
      next(err);
    }
  }

  async addSubjectSubscription(req, res, next) {
    try {
      const userId = res.locals.user._id;
      const subscriptionId = req.params.subscriptionId;
      let subject = await this._subjectModel.getById(subscriptionId);
      if (!subject) {
        throw new NotFoundError(`Not found subject with id ${subscriptionId}`);
      }
      res.locals.user.subjectSubscriptions.push({_id: subscriptionId, name: subject.name});
      res.locals.user.subjectSubscriptions = _.uniqBy(res.locals.user.subjectSubscriptions, '_id');
      await this._userModel.updateUser(userId, {
        subjectSubscriptions: res.locals.user.subjectSubscriptions});
      return this._send(res, 200, {subjectSubscriptions: res.locals.user.subjectSubscriptions});
    } catch (err) {
      this._logger.error('Error to add user subscribtion', err);
      next(err);
    }
  }

  async removeSubjectSubscription(req, res, next) {
    try {
      const userId = res.locals.user._id;
      const subscriptionId = req.params.subscriptionId;
      const subjectSubscriptions = (res.locals.user.subjectSubscriptions || [])
        .filter(sub => sub._id !== subscriptionId);
      await this._userModel.updateUser(userId, {subjectSubscriptions});
      return this._send(res, 200, {subjectSubscriptions});
    } catch (err) {
      this._logger.error('Error to remove user subscribtion', err);
      next(err);
    }
  }

  async addUserSubscription(req, res, next) {
    try {
      const userId = res.locals.user._id;
      const subscriptionId = req.params.subscriptionId;
      let user = await this._userModel.getUserById(subscriptionId);
      if (!user) {
        throw new NotFoundError(`Not found subject with id ${subscriptionId}`);
      }
      res.locals.user.userSubscriptions.push({_id: subscriptionId, login: user.login});
      res.locals.user.subjectSubscriptions = _.uniqBy(res.locals.user.subjectSubscriptions, '_id');
      await this._userModel.updateUser(userId, {
        userSubscriptions: res.locals.user.userSubscriptions});
      return this._send(res, 200, {userSubscriptions: res.locals.user.userSubscriptions});
    } catch (err) {
      this._logger.error('Error to add user subscribtion', err);
      next(err);
    }
  }

  async removeUserSubscription(req, res, next) {
    try {
      const userId = res.locals.user._id;
      const subscriptionId = req.params.subscriptionId;
      const userSubscriptions = (res.locals.user.userSubscriptions || []).filter(sub => sub._id !== subscriptionId);
      await this._userModel.updateUser(userId, {userSubscriptions});
      return this._send(res, 200, {userSubscriptions});
    } catch (err) {
      this._logger.error('Error to remove user subscribtion', err);
      next(err);
    }
  }

  async updateUser(req, res, next) {
    try {
      const userId = res.locals.user._id;
      if (req.body.email) {
        await this._validateEmailUpdate(req);
        await this._userModel.updateUser(userId, {
          email: req.body.email
        });
      } else if (req.body.login) {
        await this._validateLoginUpdate(req);
        await this._userModel.updateUser(userId, {
          login: req.body.login
        });
      } else if (req.body.description) {
        await this._validateDescriptionUpdate(req);
        await this._userModel.updateUser(userId, {
          description: req.body.description
        });
      } else {
        await this._validatePasswordUpdate(req);
        if (!await this._userModel.verify(req.body.newPassword, res.locals.user.salt, res.locals.user.hash)) {
          const {salt, hash} = await this._userModel.createHash(req.body.newPassword);
          await this._userModel.updateUser(userId, {
            salt,
            hash
          });
        } else {
          throw new UnauthorizedError('Невірний пароль');
        }
      }
      return this._send(res, 200);
    } catch (err) {
      this._logger.error('Error to update user', err);
      next(err);
    }
  }

  async _validateEmailUpdate(req) {
    try {
      let validations = [
        body('email')
          .notEmpty().withMessage('Необхідно вказати пошту')
          .isEmail().withMessage('Має бути поштою')
          .custom((value) => {
            let query = this._userModel.findOne({ email: value});
            return query.exec().then(user => {
              if (user) {
                return Promise.reject('Акаунт із вказаною поштою вже існує');
              }
            });
          })
      ];
      await this._validate(req, validations);
    } catch (err) {
      throw new ValidationError('Update email error', err);
    }
  }

  async _validateLoginUpdate(req) {
    try {
      let validations = [
        body('login')
          .notEmpty().withMessage('Необхідно вказати ім\'я користувача')
          .isLength({min: 4, max: 20}).withMessage('Має містити принаймні 4 символи')
          .matches(/^[a-zA-Z0-9_]*$/).withMessage('Дозволено тільки латинські букви та цифри')
          .custom((value) => {
            let query = this._userModel.findOne({ login: {$regex: new RegExp(`^${value}$`, 'i')}});
            return query.exec().then(user => {
              if (user) {
                return Promise.reject('Вказане ім\'я користувача вже зайнято');
              }
            });
          })
      ];
      await this._validate(req, validations);
    } catch (err) {
      throw new ValidationError('Update login error', err);
    }
  }

  async _validatePasswordUpdate(req) {
    try {
      let validations = [
        body('password')
          .notEmpty().withMessage('Необхідно вказати поточний пароль'),
        body('newPassword')
          .notEmpty().withMessage('Необхідно вказати новий пароль')
          .matches(/(?=.*\d)/).withMessage('Пароль має містити хоч одну цифру')
          .matches(/(?=.*[a-z])/).withMessage('Пароль має містити хоч одну малу латинську літеру')
          .matches(/(?=.*[A-Z])/).withMessage('Пароль має містити хоч одну велику латинську літеру')
          .isLength({min: 8}).withMessage('Пароль має містити принаймні 8 символів'),
        body('newPasswordRepeat')
          .notEmpty().withMessage('Необхідно підтвердити новий пароль')
          .equals(req.body.newPassword).withMessage('Паролі повинні співпадати')
      ];
      await this._validate(req, validations);
    } catch (err) {
      throw new ValidationError('Update password error', err);
    }
  }

  async _validateDescriptionUpdate(req) {
    try {
      let validations = [
        body('description')
          .isLength({max: 512}).withMessage('Має містити до 512 символів')
      ];
      await this._validate(req, validations);
    } catch (err) {
      throw new ValidationError('Update description error', err);
    }
  }
  
  _send(res, status, data = {}, age = 5) {
    return res.set('Cache-Control', `public, max-age=${age}`).status(status).json(data);
  }

  async _validate(req, validations) {
    await Promise.all(validations.map(validation => validation.run(req)));
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return;
    }
    throw errors;
  }
}
