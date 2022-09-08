'use strict';

import { createContainer, asClass, InjectionMode, asValue } from 'awilix';
import express from 'express';
import { expressjwt } from 'express-jwt';
import swagger from 'swagger-ui-express';
import swaggerJSDoc from 'swagger-jsdoc';
import log4js from 'log4js';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import UserService from './user/user.service.es6';
import UserRouter from './user/user.router.es6';
import UserModel from './user/user.model.es6';
import Database from './db/database.es6';
import * as errorHandlerModule from './errorHandler/errorHandler.es6';
import ArticleModel from './content/models/article.model.es6';
import CommentModel from './content/models/comment.model.es6';
import TagModel from './content/models/tag.model.es6';
import SubjectModel from './content/models/subject.model.es6';
import ContentRouter from './content/content.router.es6';
import ContentService from './content/content.service.es6';

const config = require('./config.js');

/**
 * Server service class
 */
export default class Service {

  /**
   * Construct server service 
   */
  constructor() {
    this._container = createContainer({
      injectionMode: InjectionMode.PROXY
    });
    this._routers = [];
    this._logger = log4js.getLogger('Application');
  }

  /**
   * Start server service
   */
  async start(conf) {
    conf = conf || config;
    this._configureLogs(conf);
    this._initServer(conf);
    await this.connectDB(conf)
      .then(() => {
        this._server.listen(conf.port, () => {
          this._logger.info(`Server listening on ${conf.port}`);
        });
        this._registerShutdown();
      });
  }

  /**
   * Stop server service
   */
  async stop() {
    this._server = null;
    this._routers = [];
    if (this._db) {
      await this._db.disconnect();
    }
    await this._container.dispose();
  }

  /**
   * Register services with Dependency injection framework
   */
  registerServices(conf) {
    this._container.register({
      config: asValue(conf),
      userService: asClass(UserService).singleton(),
      userRouter: asClass(UserRouter).singleton(),
      userModel: asClass(UserModel).singleton(),
      articleModel: asClass(ArticleModel).singleton(),
      commentModel: asClass(CommentModel).singleton(),
      tagModel: asClass(TagModel).singleton(),
      subjectModel: asClass(SubjectModel).singleton(),
      сontentRouter: asClass(ContentRouter).singleton(),
      contentService: asClass(ContentService).singleton()
    });
  }

  /**
   * Register routers
   */
  registerRouters() {
    this._addRouter('/', container => container.resolve('userRouter').router());
    this._addRouter('/', container => container.resolve('сontentRouter').router());
  }

  /**
   * Connect server to database
   * @returns {Promise}
   */
  connectDB(conf) {
    if (conf.db) {
      this._db = new Database(conf);
      return this._db.connect();
    } else {
      return Promise.resolve();
    }
  }

  /**
   * Init server middleware, routers, swagger and error handler
   */
  _initServer(conf) {
    this._server = express();
    this.registerServices(conf);
    this.registerRouters();
    this._server.use(this._jwt(conf));
    this._server.use(express.urlencoded({extended: false, limit: '50mb'}));
    this._server.use(express.json({limit: '50mb'}));
    this._server.use(express.text({limit: '50mb'}));
    this._server.use(cors());
    this._routers.forEach((router) => {
      this._server.use(router.url, router.provider(this._container));
    });

    const swaggerOptions = {     
      failOnErrors: true, // Whether or not to throw when parsing errors. Defaults to false.
      definition: {
        openapi: '3.0.0',
        info: {
          title: 'Reviewton',
          version: '1.0.0'
        }
      },
      apis: ['app/*/*.router.es6']
    };
    this._server.use('/api-docs', swagger.serve, swagger.setup(swaggerJSDoc(swaggerOptions)));

    this._server.use(errorHandlerModule.errorHandler);
  }
  
  /**
   * Add router to init
   * @param {String} url router url
   * @param {Router} provider 
   */
  _addRouter(url, provider) {
    this._routers.push({
      url,
      provider
    });
  }

  /**
   * Override server shutdown procces
   */
  _registerShutdown() {
    let shutdown = () => this.stop()
      .then(() => this._logger.info('Server stopped, terminating...'))
      .then(() => process.exit(), () => process.exit());
      
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }

  /**
   * JWT middleware
   * @returns {Promise} jwt middleware
   */
  _jwt(conf) {
    const secret = conf.secret;
    let isRevoked = async (req, res, next) => {
      const user = this._container.getRegistration('userService').getById(res.sub);
      if (!user) {
        return next(null, true);
      }
      next();
    };
    return expressjwt({secret, algorithms: ['HS256'], isRevoked}).unless({
      // public routes that don't require authentication
      path: [
        '/user/register',
        '/user/authenticate',
        '/content/articles',
        '/content/tags',
        /api-docs.*/
      ]
    });
  }

  /**
   * Configure log4js service
   */
  // eslint-disable-next-line complexity
  _configureLogs(conf) {
    let logPath = path.join('logs', 'application.log');
    let logDirPath = path.dirname(logPath);
    if (!fs.existsSync(logDirPath)) {
      fs.mkdirSync(logDirPath);
    }
    const appenders = {
      file: {
        type: 'dateFile',
        filename: logPath,
        pattern: 'yyyy-MM-dd',
        numBackups: (conf.log4js || {}).backups || 1,
        keepFileExt: true,
        timezoneOffset: 0
      }
    };
    const defaultAppenders = ['file'];
    if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'staging') {
      appenders.console = {type: 'console'};
      defaultAppenders.push('console');
    }
    const categories = {
      default: {
        appenders: defaultAppenders,
        level: log4js.levels[(conf.log4js || {}).defaultLevel || 'INFO']
      }
    };
    const configLevels = ((conf.log4js || {}).levels || {});
    Object.keys(configLevels).forEach((category) => {
      categories[category] = {
        appenders: defaultAppenders,
        level: log4js.levels[configLevels[category]]
      };
    });
    log4js.configure({
      appenders: appenders,
      categories: categories
    });
  }
}
