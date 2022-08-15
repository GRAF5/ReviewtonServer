'use strict';

//import log4js from 'log4js';
//let logger = log4js.getLogger('errorHandler');
let id = 1;

export function errorHandler(err, req, res) {
  res.status(err.status || 500);
  res.send(composeError(err));
}

export function composeError(err) {
  let response = {
    id: id++,
    error: err.name,
    message: err.message
  };
  if (err.details) {
    response.details = err.details;
  }

  return response;
}

/**
 * Base class for server error
 */
export class ApiError extends Error {

  /**
   * ApiError constructor
   * @param {String} clazz error name 
   * @param {String} message error message 
   * @param {Number} status HTTP status 
   */
  constructor(clazz, message, status) {
    super(message);
    this.name =  clazz.name;
    this.status = status;
    Error.captureStackTrace(this, clazz);
  }
}

/**
 * Validation error that throw 400 (Bad Request) HTTP response code
 */
export class ValidationError extends ApiError {

  /**
   * Validation error constructor
   * @param {String} message error message 
   * @param {Object} details error details
   */
  constructor(message, details) {
    super (ValidationError, message, 400);
    this.details = details;
  }
}

/**
 * Unauthorized error that throw 401 (Unauthorized Request) HTTP response code
 */
export class UnauthorizedError extends ApiError {

  /**
   * Unauthorized error constructor
   * @param {String} message error message 
   * @param {Object} details error details
   */
  constructor(message) {
    super (ValidationError, message, 401);
  }
}
