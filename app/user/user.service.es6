'use strict';

import { body, param, validationResult } from 'express-validator';
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
   * @param {ArticleModel} param0.articleModel article model
   */
  constructor({config, userModel, articleModel}) {
    this._config = config;
    this._userModel = userModel.User;
    this._articleModel = articleModel.Article;
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
      let user = new this._userModel({...req.body, salt, hash, _id});
      await user.save();
      res.status(200).json({_id});
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
          .custom((value) => {
            let query = this._userModel.findOne({ login: value});
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
          .matches(/(?=.*[a-z])/).withMessage('Пароль має містити хоч одну велику латинську літеру')
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

  /**
   * Add viewed article to user
   */
  async addViewed(req, res, next) {
    try {
      await this._validateAddViewed(req);
      let user = await this._userModel.findOne({_id: req.params.id});
      let article = await this._articleModel.findOne({_id: req.body.article});
      if (user.viewed.indexOf(article._id) === -1) {
        article.views++;
        await article.save();
        user.viewed.push(article._id);
        await user.save();
      }
      return res.status(200).send();
    } catch (err) {
      this._logger.error('Error while add viewed article', err);
      next(err);
    }
  }

  async _validateAddViewed(req) {
    try {
      let validations = [
        param('id')
          .notEmpty().withMessage('Необхідно вказати автора')
          .custom((value) => {
            let query = this._userModel.findOne({ _id: value});
            return query.exec().then(user => {
              if (!user) {
                return Promise.reject('Користувача не знайдено');
              }
            });
          }),
        body('article')
          .notEmpty().withMessage('Необхідно вказати статтю')
          .custom((value) => {
            let query = this._articleModel.findOne({ _id: value});
            return query.exec().then(article => {
              if (!article) {
                return Promise.reject('Статті не знайдено');
              }
            });
          })
      ];
      await this._validate(req, validations);
    } catch (err) {
      throw new ValidationError('Add viewed article error', err);
    }
  }

  /**
   * Get user viewed articles
   */
  async getViewed(req, res, next) {
    try {
      await this._validateGetViewed(req);
      let user = await this._userModel.findOne({_id: req.params.id});
      let articles = await this._articleModel.find({_id: {$in: user.viewed}});
      return res.status(200).json({articles});
    } catch (err) {
      this._logger.error('Error while get viewed article', err);
      next(err);
    }
  }

  async _validateGetViewed(req) {
    try {
      let validations = [
        param('id')
          .notEmpty().withMessage('Необхідно вказати автора')
          .custom((value) => {
            let query = this._userModel.findOne({ _id: value});
            return query.exec().then(user => {
              if (!user) {
                return Promise.reject('Користувача не знайдено');
              }
            });
          })
      ];
      await this._validate(req, validations);
    } catch (err) {
      throw new ValidationError('Add viewed article error', err);
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

  async _validate(req, validations) {
    await Promise.all(validations.map(validation => validation.run(req)));
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return;
    }
    throw errors;
  }
}
