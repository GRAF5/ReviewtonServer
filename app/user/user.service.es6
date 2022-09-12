'use strict';

import jwt from 'jsonwebtoken';
import log4js from 'log4js';
import { v4 } from 'uuid';
import { UnauthorizedError } from '../errorHandler/errorHandler.es6';
import { ValidationError } from '../errorHandler/errorHandler.es6';

/**
 * Class for users requests
 */
export default class UserService {

  /**
   * User service constructor
   * @param param0 
   * @param {Config} param0.config server config
   * @param {UserModel} param0.userModel user model
   */
  constructor({config, userModel}) {
    this._config = config;
    this._userModel = userModel.User;
    this._logger = log4js.getLogger('UserService');
  }

  /**
   * Register new user
   */
  // eslint-disable-next-line complexity
  async register(req, res, next) {
    try {
      let errors = [];
      if (!req.body.login) {
        errors.push({
          arg: 'login',
          message: 'Необхідно вказати ім\'я користувача'
        });
      } else if (await this._userModel.findOne({login: req.body.login})) {
        errors.push({
          arg: 'login',
          message: 'Вказане ім\'я користувача вже зайнято'
        });
      }
      if (!req.body.email) {
        errors.push({
          arg: 'email',
          message: 'Необхідно вказати пошту'
        });
      } else if (await this._userModel.findOne({email: req.body.email})) {
        errors.push({
          arg: 'email',
          message: 'Акаунт із вказаною поштою вже існує'
        });
      }
      if (!req.body.password) {
        errors.push({
          arg: 'password',
          message: 'Необхідно вказати пароль'
        });
      }
      if (!req.body.passwordRepeat) {
        errors.push({
          arg: 'passwordRepeat',
          message: 'Необхідно підтвердити пароль'
        });
      }
      if (req.body.password !== req.body.passwordRepeat) {
        errors.push({
          arg: 'passwordRepeat',
          message: 'Паролі повинні співпадати'
        });
      }
      if (!/(?=.*\d)/.test(req.body.password)) {
        errors.push({
          arg: 'password',
          message: 'Пароль має містити хоч одну цифру'
        });
      }
      if (!/(?=.*[a-z])/.test(req.body.password)) {
        errors.push({
          arg: 'password',
          message: 'Пароль має містити хоч одну малу латинську літеру'
        });
      }
      if (!/(?=.*[A-Z])/.test(req.body.password)) {
        errors.push({
          arg: 'password',
          message: 'Пароль має містити хоч одну велику латинську літеру'
        });
      }
      if (!/[a-zA-Z0-9]{8,}/.test(req.body.password)) {
        errors.push({
          arg: 'password',
          message: 'Пароль має містити принаймні 8 символів'
        });
      }
      if (errors.length) {
        throw new ValidationError('Register error', errors);
      }

      const {salt, hash} = await this._userModel.createHash(req.body.password);
      const _id = v4();
      let user = new this._userModel({...req.body, salt, hash, _id});
      await user.save();
      res.status(200).json({_id});
    } catch (err) {
      this._logger.error('Error while register', err);
      next(err);
    }
  }

  /**
   * Authenticate user
   */
  async authenticate(req, res, next) {
    try {
      let errors = [];
      if (!req.body.credentials) {
        errors.push({
          arg: 'credentials',
          message: 'Необхідно вказати ім\'я користувача або пошту'
        });
      }
      if (!req.body.password) {
        errors.push({
          arg: 'password',
          message: 'Необхідно вказати пароль'
        });
      }
      if (errors.length) {
        throw new ValidationError('Register error', errors);
      }
      
      const user = await this._userModel.findOne(
        {login: req.body.credentials}) || await this._userModel.findOne({email: req.body.credentials});
      if (user && await this._userModel.verify(req.body.password, user.salt, user.hash)) {
        const token = jwt.sign({sub: user.id}, this._config.secret, { expiresIn: '7d'});
        res.status(200).json({ token, id: user.id, login: user.login, email: user.email});
      } else {
        throw new UnauthorizedError('Невірний логін або пароль');
      }
    } catch (err) {
      this._logger.error('Error while authenticate', err);
      next(err);
    }
  }

  /**
   * Get user by id
   * @param {String} id user id
   * @return {User} user
   */
  async getById(id) {
    return this._userModel.find({_id : id}).lean();
  }
}
