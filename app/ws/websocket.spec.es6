'use strict';

import sinon from 'sinon';
import {io} from 'socket.io-client';
import Service from '../server.es6';
import should from 'should';
import log4js from 'log4js';

const config = {
  port: 3030
};
const app = new Service();
const WS_AWAIT = 100;

describe('Websocket', () => {

  let ws;
  let client;
  let sandbox;

  before(async () => {
    sandbox = sinon.createSandbox();
    sandbox.stub(log4js, 'getLogger').returns({
      error: () => {},
      info: () => {}
    });
    await app.start(config);
    ws = app._container.resolve('websocket');
  });

  afterEach(() => {
    ws._enabled = true;
    if (client) {
      client.disconnect();
    }
    sandbox.restore();
  });

  after(async () => {
    await app.stop();
  });

  it('should subscribe to route', async () => {
    let mock = sandbox.mock();
    mock.once();
    let id = ws.subscribe(/test/, [{event: 'get', listeners: [async (context, next) => {
      context.data.should.be.eql({id: 1});
      context.test = 'test';
      next();
    }, mock]}]);
    should.exist(id);
    // let id;
    // id = ws.subscribe(/test-\d+/, [{event: 'test', listener: 
    //   ((...args) => console.log(`${args} ${id}`)).bind(this)}]);
    client = io('http://localhost:3030/test');
    // client.on('ev', (...args) => console.log(args));
    await new Promise(res => setTimeout(res, WS_AWAIT));
    client.emit('get', {data: {id: 1}});
    await new Promise(res => setTimeout(res, WS_AWAIT));
    ws.unsubscribe(id);
    mock.verify();
  });
  
  it('should disconnect id ws not enabled', async () => {
    let id = ws.subscribe(/test/, [{event: 'get', listener: () => {}}]);
    ws._enabled = false;
    client = io('http://localhost:3030/test');
    await new Promise(res => setTimeout(res, WS_AWAIT));
    ws.unsubscribe(id);
  });
});
