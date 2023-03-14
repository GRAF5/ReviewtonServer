'use strict';

import log4js from 'log4js';
import { Server } from 'socket.io';

/**
 * Class for websockets setup
 */
export default class Websocket {

  /**
   * Constructs Websockets service
   * @param param0 
   * @param {Config} param0.config server config
   */
  constructor({config}) {
    this._config = config;
    this._nsps = [];
    this._sockets = [];
    this._routes = {};
    this._logger = log4js.getLogger('Websocket');
  }

  /**
   * Init websockets service
   * @param {HttpServer} server http server
   */
  start(server) {
    this._io = new Server(server, {
      // event: this._config.websocket.event,
      serveClient: false,
      cookie: false,
      cors: {}
    });
    this._enabled = true;
  }

  /**
   * Stop websockets service
   */
  stop() {
    this._enabled = false;
    if (this._sockets.length) {
      this._sockets.forEach(s => s.disconnect(true));
    }
    if (this._io) {
      this._io.engine.close();
      delete this._io;
    }
    this._sockets = [];
    this._routes = {};
  }

  /**
   * Subscribe websockets to new routes
   * @param {RegExp|String} reg route regex
   * @param {Array<{event, listeners}>} routes array of objects of specified event and listeners. 
   * @param {String} routes[].event specified event
   * @param {Array<(context) => {}>} routes[].listeners listener of specified event
   * @returns {String} websocket namespace id 
   */
  subscribe(reg, routes) {
    try {
      const nsp = this._io.of(reg).on('connection', (socket) => {
        if (this._enabled) {
          const invokeListeners = async (socketId, route, data, listeners) => {           
            const context = {
              socketId,
              route,
              data};
            let index = -1;
            const next = err => {
              index++;
              if (!err && index < listeners.length) {
                listeners[index](context, next);
              }
            };
            next();
          };
          this._sockets.push(socket);
          socket.join(socket.id);
          socket.join(socket.nsp.name);
          for (let route of routes) {
            socket.on(route.event, async (packet) => {
              const data = packet?.data || {}; 
              await invokeListeners(socket.id, socket.nsp.name, data, route.listeners);
            });//route.listener.bind(this, socket.id, socket.nsp.name));
          }
          socket.on('disconnect', () => {
            this._sockets.splice(this._sockets.indexOf(socket), 1);
          });
        } else {
          socket.disconnect(true);
        }
      });
      this._nsps.push(nsp);
      this._routes[nsp.name] = reg;
      return nsp.name;
    } catch (err) {
      this._logger.error('Failed subscribe wssocket', err);
    }
  }

  /**
   * Remove websocket namespace
   * @param {String} nspId namespace id
   */
  unsubscribe(nspId) {
    let nsp = this._nsps.find(n => n.name === nspId);
    if (nsp.connected) {
      const connectedSockets = Object.keys(nsp.connected);
      connectedSockets.forEach(socketId => {
        nsp.connected[socketId].disconnect();
      });
    }
    nsp.removeAllListeners();
    this._nsps = this._nsps.filter(n => n.name !== nspId);
    delete this._io._nsps[this._routes[nspId]];
    delete this._routes[nspId];
  }

  /**
   * Sending a message to a specific socket 
   * @param {String} nspId namespace id
   * @param {String} channel ID of the socket / room to send a message to
   * @param {String} event type of an event to be sent with the message
   * @param {any} args 
   */
  emit(nspId, channel, event, ...args) {
    const nsp = this._nsps.find(n => n.name === nspId);
    if (!nspId) {
      throw new Error(`Not found namespace ${nspId}`);
    }
    nsp.to(channel).emit(event, ...args);
  }
}
