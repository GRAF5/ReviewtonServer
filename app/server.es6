'use strict';

import { createContainer, asClass, InjectionMode, asValue } from 'awilix';
import express from 'express';
import http from 'http';
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
import AuthorizationRouter from './authorization/authorization.router.es6';
import AuthorizationService from './authorization/authorization.service.es6';
import Websocket from './ws/websocket.es6';
import ContentSocketService from './content/contentSocket.service.es6';

const config = process.env.CONFIG ? require(process.env.CONFIG) : require('./config.js');

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
        this._connection = this._httpServer.listen(conf.port, () => {
          this._logger.info(`Server listening on ${conf.port}`);
        });
        this._registerShutdown();
      });
    await this._container.resolve('websocket').start(this._httpServer);
    await this._container.resolve('contentSocketService').start();
  }

  /**
   * Stop server service
   */
  async stop() {
    await this._container.resolve('contentSocketService').stop();
    await this._container.resolve('websocket').stop();
    this._server = null;
    this._routers = [];
    if (this._db) {
      await this._db.disconnect();
    }
    await this._container.dispose();
    let resolve, reject;
    let promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    promise.resolve = (result) => {
      promise.reject = () => {};
      promise.resolved = true;
      resolve(result);
    };
    promise.reject = (err) => {
      promise.resolve = () => {};
      promise.rejected = true;
      reject(err);
    };
    this._logger.info('Server stopped, terminating...');
    log4js.shutdown((err) => {
      if (err) {
        promise.reject(err);
      }
      promise.resolve();
    });
    await promise;
    if (this._connection) {
      await new Promise((res, rej) => this._connection.close(err => err ? rej(err) : res()));
    }
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
      contentRouter: asClass(ContentRouter).singleton(),
      contentService: asClass(ContentService).singleton(),
      authorizationRouter: asClass(AuthorizationRouter).singleton(),
      authorizationService: asClass(AuthorizationService).singleton(),
      websocket: asClass(Websocket).singleton(),
      contentSocketService: asClass(ContentSocketService).singleton()
    });
  }

  /**
   * Register routers
   */
  registerRouters() {
    this._addRouter('/', container => container.resolve('userRouter').router());
    this._addRouter('/', container => container.resolve('contentRouter').router());
    this._addRouter('/', container => container.resolve('authorizationRouter').router());
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
    this._httpServer = http.createServer(this._server);
    this.registerServices(conf);
    this.registerRouters();
    //this._server.use(this._jwt(conf));
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
        openapi: '3.0.1',
        info: {
          title: 'Reviewton',
          version: '1.0.0'
        },
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT'
            }
          }
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
      .then(() => process.exit(), () => process.exit());
      
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }

  /**
   * Configure log4js service
   */
  // eslint-disable-next-line complexity
  _configureLogs(conf) {
    let logPath = path.join(__dirname, 'logs', 'application.log');
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
    // if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'staging') {
    appenders.console = {type: 'console'};
    defaultAppenders.push('console');
    // }
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
