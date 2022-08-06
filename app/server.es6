'use strict';

import { createContainer, asClass, InjectionMode, asValue } from 'awilix';
import express from 'express';
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
  async start() {
    this._configureLogs();
    this._initServer();
    this.connectDB()
      .then(() => {
        this._server.listen(config.port, () => {
          this._logger.info(`Server listening on ${config.port}`);
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
      this._db.disconnect();
    }
  }

  /**
   * Register services with Dependency injection framework
   */
  registerServices() {
    this._container.register({
      config: asValue(config),
      userService: asClass(UserService),
      userRouter: asClass(UserRouter),
      userModel: asClass(UserModel)
    });
  }

  /**
   * Register routers
   */
  registerRouters() {
    this._addRouter('/', container => container.resolve('userRouter').router());
  }

  connectDB() {
    if (config.db) {
      this._db = new Database({config});
      return this._db.connect();
    } else {
      return Promise.resolve();
    }
  }

  _initServer() {
    this._server = express();
    this.registerServices();
    this.registerRouters();
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
  }
  
  _addRouter(url, provider) {
    this._routers.push({
      url,
      provider
    });
  }

  _registerShutdown() {
    let shutdown = () => this.stop()
      .then(() => this._logger.info('Server stopped, terminating...'))
      .then(() => process.exit(), () => process.exit());
      
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }

  // eslint-disable-next-line complexity
  _configureLogs() {
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
        numBackups: (config.log4js || {}).backups || 1,
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
        level: log4js.levels[(config.log4js || {}).defaultLevel || 'INFO']
      }
    };
    const configLevels = ((config.log4js || {}).levels || {});
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
