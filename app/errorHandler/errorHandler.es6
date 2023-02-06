'use strict';

//import log4js from 'log4js';
//let logger = log4js.getLogger('errorHandler');
let id = 1;

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
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
 * Bad request error that throw 400 (Bad Request) HTTP response code
 */
export class BadRequestError extends ApiError {

  /**
   * Validation error constructor
   * @param {String} message error message 
   */
  constructor(message) {
    super (ValidationError, message, 400);
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
   */
  constructor(message) {
    super (UnauthorizedError, message, 401);
  }
}

/**
 * Forbidden error that throw 403 (Forbidden) HTTP response code
 */
export class ForbiddenError extends ApiError {

  /**
   * Forbidden error constructor
   * @param {String} message error message 
   */
  constructor(message) {
    super (ForbiddenError, message, 403);
  }
}

/**
 * Not found error that throw 404 (Not Found) HTTP response code
 */
export class NotFoundError extends ApiError {

  /**
   * Not found error constructor
   * @param {String} message error message 
   */
  constructor(message) {
    super (NotFoundError, message, 404);
  }
}
