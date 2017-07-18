const winston = require('winston')
const { json } = require('micro')

const resAllow = [ 'domain', 'output', 'outputEncodings', 'outputSize',
  'writable', 'upgrading', 'chunkedEncoding', 'shouldKeepAlive',
  'useChunkedEncodingByDefault', 'sendDate', '_contentLength', '_hasBody',
  '_trailer', 'finished', '_headerSent', '_header', '_headers',
  '_headerNames' ]

const reqAllow = [ 'readable', 'domain', '_events', '_eventsCount',
  '_maxListeners', 'httpVersionMajor', 'httpVersionMinor', 'httpVersion',
  'complete', 'headers', 'rawHeaders', 'trailers', 'rawTrailers',
  'upgrade', 'url', 'method', 'statusCode', 'statusMessage',
  '_consuming', '_dumped', 'params', 'query' ]

const filterObj = (obj, keys) => {
  let cleanObj = {}
  keys.forEach((k) => { cleanObj[k] = obj[k] })
  return cleanObj
}

const getIp = (req) => req.headers['x-forwarded-for'] ||
  req.connection.remoteAddress ||
  req.socket.remoteAddress ||
  req.connection.socket.remoteAddress

const getLogLevel = (res) => {
  if (res.statusCode < 400) {
    return 'info'
  } else if (res.statusCode < 500) {
    return 'warn'
  } else {
    return 'error'
  }
}

const microLogger = (fn, winstonInstance) => {
  return async (req, res) => {
    let startTime = new Date()
    try {
      let ret = await fn(req, res)

      let cleanReq = {}
      reqAllow.forEach((k) => { cleanReq[k] = req[k] })

      let logData = {
        ip: getIp(req),
        req: filterObj(req, reqAllow),
        res: filterObj(res, resAllow),
        requestBody: (req._hasBody) ? await json(req) : null,
        responseBody: ret,
        responseTime: new Date() - startTime
      }
      let msg = `${req.method} ${req.url} ${res.statusCode} ${logData.responseTime}ms`
      let level = getLogLevel(res)

      winstonInstance.log(level, msg, logData)

      return ret
    } catch (err) {
      let exceptionMeta = winston.exception.getAllInfo(err)

      var logData = {}
      try {
        logData = {
          ip: getIp(req),
          req: filterObj(req, reqAllow),
          res: filterObj(res, resAllow),
          requestBody: (req._hasBody) ? await json(req) : null,
          responseTime: new Date() - startTime
        }
      } catch (e) {}

      logData.exceptionMeta = exceptionMeta

      winstonInstance.log(getLogLevel(res), err.message || err, logData)
      throw err
    }
  }
}

module.exports = { microLogger }
