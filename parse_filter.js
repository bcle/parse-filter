var Proxy = require('mitm-proxy')
  , URL = require('url');

var optionsParser = Proxy.getOptionsParser();
var options = optionsParser.parse();
options.request_filter = request_filter;
options.response_filter = response_filter;

var proxy = new Proxy(options);
var log = proxy.getLogger();

/*
 * reqFromApp: The http request from the client application.
 *             In addition to regular properties, 'body' contains the body buffer.
 *             You may modify this object.
 * respToApp: An optional response to the app. If you choose not to forward to the remote server,
 *            use this object to complete the request, and no not call next()
 * next: Call this function to continue processing of the request.
 *       This forwards the (potentially modified) request to the remote server.
 */
function request_filter(reqFromApp, respToApp, next) {
  var ctype = reqFromApp.headers['content-type']; 
  if (ctype && ctype.indexOf('application/json') >= 0) {
    var body = reqFromApp.body;
    log.warn('Request filter: %s with json body of length %d on URL %s : \n%s',
      reqFromApp.method,
      body? body.length : 0,
      reqFromApp.url,
      body? body.toString() : ''
    );
  }
  next();
}

/*
 * reqFromApp: The http request from the client application.
 *             In addition to regular properties, 'body' contains the body buffer.
 *             You may modify this object.
 * respToApp: An optional response to the app. If you choose not to forward to the remote server,
 *            use this object to complete the request, and no not call next()
 * next: Call this function to continue processing of the request.
 *       This forwards the (potentially modified) request to the remote server.
 */
function response_filter(reqFromApp, respFromRemote, next) {
  var ctype = respFromRemote.headers['content-type'];
  if (ctype && ctype.indexOf('application/json') >= 0) {  
    var body = respFromRemote.body;
    log.warn('Response filter: status %d with json body of length %d: \n%s',
      respFromRemote.statusCode,
      body? body.length : 0,
      body? body.toString() : ''
    );
  }

  next();
}

