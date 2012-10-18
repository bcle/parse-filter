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
  var body = reqFromApp.body;
  if (!ctype) 
    return next();

  if (ctype.indexOf('application/json') >= 0) {
    var obj = JSON.parse(body.toString());

    log.warn('Request filter: %s with json body of length %d on URL %s : \n%s',
      reqFromApp.method,
      body? body.length : 0,
      reqFromApp.url,
      body? JSON.stringify(obj, null, 2) : ''
    );

    if (obj && obj.commands && Array.isArray(obj.commands)) {
      var cmd = obj.commands[0];
      if (cmd && cmd.params && cmd.params.data) {
        var dataStr = cmd.params.data;
	var data = JSON.parse(dataStr);
	data.foo = 'bar';

	if (typeof data.name === 'string')
	  data.name = data.name + ' (hacked)';
	if (typeof data.priority === 'number')
	  data.priority += 2;
	var newStr = JSON.stringify(data);
	cmd.params.data = newStr;
	log.warn('Modified data: %s', JSON.stringify(data, null, 2)); 
	reqFromApp.body = new Buffer(JSON.stringify(obj));
      }
    }
  } else if (ctype.indexOf('text/plain') >= 0) {
    log.warn('Request filter: %s with text/plain body of length %d on URL %s : \n%s',
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
    try {
      var body = respFromRemote.body;
      var obj = JSON.parse(body.toString());
      log.warn('response filter: status %d with json body of length %d: \n%s',
        respFromRemote.statusCode,
        body? body.length : 0,
        body? JSON.stringify(obj, null, 2) : ''
      );
    } catch (err) {
      log.error('Caught exception during response body processing: %s', err);
    }
  }

  next();
}

