var Proxy = require('mitm-proxy')
  , hexy = require('hexy')
  , tmp = require('tmp')
  , fs = require('fs')
  , qs = require('querystring')
  , URL = require('url');

var optionsParser = Proxy.getOptionsParser();
var options = optionsParser.parse();
options.request_filter = request_filter;
options.response_filter = response_filter;

var proxy = new Proxy(options);
var log = proxy.getLogger();
var zlib = require('zlib');

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
  if (!ctype) 
    return next();

  var body = reqFromApp.body;
  var obj = null; // JSON body

  log.warn('Request filter: %s %s enc [%s] body length %d body:\n%s',
    reqFromApp.method,
    reqFromApp.url,
    ctype,
    body? body.length : 0,
    body? body.toString():'');

  if (ctype.indexOf('application/x-www-form-urlencoded') >= 0) {
    var urlenc_str = body.toString();
    log.trace('Request filter: %s with x-www-form-urlencoded body of length %d on URL %s : \n%s',
      reqFromApp.method,
      body? body.length : 0,
      reqFromApp.url,
      urlenc_str
    );
    try {
      obj = qs.parse(urlenc_str);
      log.trace('Request filter: decoded URL-encoded body:\n%s\n', JSON.stringify(obj, null, 2));
    } catch (err) {
      log.error('Caught exception [%s] while parsing url-encoded string: %s', err, urlenc_str);
    }
  } else if (ctype.indexOf('application/json') >= 0) {
    obj = JSON.parse(body.toString());

    log.warn('Request filter: %s with json body of length %d on URL %s : \n%s',
      reqFromApp.method,
      body? body.length : 0,
      reqFromApp.url,
      body? JSON.stringify(obj, null, 2) : ''
    );
  }
  if (obj) {
    if (typeof obj.data === 'string') {
      try {
	var data = JSON.parse(obj.data);
	obj.data = data;
        log.warn('Request filter: %s with url-encoded json body of length %d on URL %s : \n%s',
                  reqFromApp.method,
                  body? body.length : 0,
                  reqFromApp.url,
                  JSON.stringify(obj, null, 2));
      } catch (err) {
        log.error('Caught exception %s while parsing JSON from string: %s', err, obj.data);
      }
    } else if (obj.commands && Array.isArray(obj.commands)) {
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
  var body = respFromRemote.body;

  if (!body || !body.length)
    return next();

  var ctype = respFromRemote.headers['content-type'];
  if (!ctype || ctype.indexOf('application/json') < 0)
    return next();

  var encoding = respFromRemote.headers['content-encoding'];
  if (!encoding) {
    decode_json(null, body);
  } else if (encoding === 'gzip') {
    log.warn('Response filter: decompressing gzip buffer of size: %d', body.length);
    zlib.gunzip(body, decode_json); 
  } else {
    log.warn('Response filter: ignoring JSON body with unknown content encoding: %s', encoding);
    next();
  }

  function decode_json(err, buf) {
    if (err) {
      log.error('Response filter: gzip decoding failed: %s', err);
    } else try {
      var str = buf.toString();
      if (encoding === 'gzip')
        log.warn('Response filter: decompressed from %d to %d bytes', body.length, buf.length);
      try {
        var obj = JSON.parse(str);
        log.warn('Response filter: status %d with json body of length %d: \n%s',
          respFromRemote.statusCode,
          buf? buf.length : 0,
          buf? JSON.stringify(obj, null, 2) : ''
        );  
      } catch (err) {
        log.error('Caught exception %s while parsing JSON from string: %s', err, str);
        var opts = { prefix: 'bad-json-' + (encoding? (encoding + '-'):''), keep: true };
        tmp.file(opts, function tmpFileCb(err, path) {
          if (err) return next();
          fs.writeFile(path, body, function writeFileCb(err) {
            if (!err)
	      log.warn('Body containing bad JSON written to: %s', path);
          });
        });
      }
    } catch (err) {
      log.error('Caught exception during response body processing: %s', err);
    }
    next();
  }
}

//------------------------------------------------------------------------------------------------

function binary_to_ascii_dump(buf, bytesPerLine) {
  var bpl = bytesPerLine || 64;
  var len = buf.length;
  var offset = 0;
  var str = '';
  while (offset < len) {
    for (i = 0; i < bpl && offset < len; i++) {
      byte = buf[offset];
      if (byte >= 0x20 && byte <= 0x7e) {
        str = str + String.fromCharCode(byte);
      } else {
        str = str + '.';
      }
      offset++;
    }    
    str = str + "\n";
  }
  return str;
}

