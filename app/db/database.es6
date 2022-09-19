'use strict';

import mongoose from 'mongoose';
import log4js from 'log4js';

/**
 * Mongoose database class
 */
export default class Database {

  /**
   * Constructs database class
   * @param {Object} param0.config config 
   */
  constructor(config) {
    this._config = config;
    this._logger = log4js.getLogger('Databese');
  }

  /**
   * Connect to database
   */
  async connect() {
    try {
      await mongoose.connect(this._config.db.url, this._config.db.options);
      mongoose.connection.on('error', (err) => {
        this._logger.error('Connection error', err);
        this._reconnect();
      });
      this._logger.debug('Connected to the database');
    } catch (err) {
      this._logger.error('Connect error', err);
    }
  }

  /**
   * Reconnect to database through time
   */
  _reconnect() {
    setTimeout(() => {
      this.connect();
    }, (this._config.db.reсonnectTimeMilliseconds || 1000));
  }

  /**
   * Disconnect from database
   */
  async disconnect() {
    await new Promise((resolve, reject) => {
      mongoose.connection.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async clear() {
    if (mongoose.connection.readyState) {
      await new Promise((resolve, reject) => {
        mongoose.modelNames().forEach(async (name) => {
          await mongoose.models[name].deleteMany({}, (err) => {
            if (err) {
              this._logger.error('Error while clear db', err);
              reject(err);
            }
          });
        });
        resolve();
      });
    }
  }

  async delete() {
    await new Promise((resolve) => {
      mongoose.modelNames().forEach(name => {
        delete mongoose.connection.models[name];
      });
      resolve();
    });
  }
}
