var Proxy = require('mitm-proxy')
  , tmp = require('tmp')
  , fs = require('fs')
  , qs = require('querystring')
  , process_object = require('./parse_json')
  , path  = require('path')
  , crypto  = require('crypto')
  , URL = require('url');

var optionsParser = Proxy.getOptionsParser();
var options = optionsParser.parse();
options.request_filter = request_filter;
options.response_filter = response_filter;

var proxy = new Proxy(options);
var log = proxy.getLogger();
var zlib = require('zlib');

var enc_key_path = path.join(__dirname, 'aes_key.bin');
var enc_key = fs.readFileSync(enc_key_path);
var enc_algo = 'aes128';

function encode(input) {
  return 'AAAA' + input + 'AAAA';
}

function decode(input) {
  return input.substr(4, input.length-8);
}

function encrypt(input, encoding) {
  var cipher = crypto.createCipher(enc_algo, enc_key);
  var output = cipher.update(input, 'utf8', encoding);
  output = 'a' + output + cipher.final(encoding); // 'a' prepended to satisfy Parse's key name requirement
  return output;
}  

function decrypt(input, encoding) {
  input = input.substr(1, input.length - 1); // remove 'a' prefix
  var decipher = crypto.createDecipher(enc_algo, enc_key);
  var output = decipher.update(input, encoding, 'utf8');
  output = output + decipher.final('utf8');
  return output;
}  

function encrypt_key(input) { return encrypt(input, 'hex'); }
function decrypt_key(input) { return decrypt(input, 'hex'); }
function encrypt_val(input) { return encrypt(input, 'base64'); }
function decrypt_val(input) { return decrypt(input, 'base64'); }

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

  var urlInfo = URL.parse(reqFromApp.url);
  if (urlInfo.hostname !== 'api.parse.com') {
    log.warn('Skipping url with hostname: %s', urlInfo.hostname);
    return next();
  }  
  var ctype = reqFromApp.headers['content-type']; 
  if (!ctype) 
    return next();

  var api = urlInfo.pathname.split('/').pop(); // API name
  var body = reqFromApp.body;

  log.warn('Request filter: %s %s ctype [%s] api %s len %d body:\n%s',
    reqFromApp.method,
    reqFromApp.url,
    ctype,
    api,
    body? body.length : 0,
    body? body.toString():'');

  if (ctype.indexOf('application/json') < 0) {
    log.warn('Request filter: unsupported content type %s', ctype);
    return next();
  }

  var str = body.toString();
  var obj = JSON.parse(str);
  process_object(obj, encrypt_val, api, 1, encrypt_key);
  str = JSON.stringify(obj, null, 1);

  log.warn('Request filter: %s %s api %s modified body:\n%s',
    reqFromApp.method,
    reqFromApp.url,
    api,
    str);

  reqFromApp.body = new Buffer(str);
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
  var urlInfo = URL.parse(reqFromApp.url);
  if (urlInfo.hostname !== 'api.parse.com') {
    log.warn('Response filter: skipping response from hostname: %s', urlInfo.hostname);
    return next();
  }  

  var api = urlInfo.pathname.split('/').pop(); // API name
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
          buf? JSON.stringify(obj, null, 1) : ''
        );  
        process_object(obj, decrypt_val, api, 1, decrypt_key);
        str = JSON.stringify(obj, null, 1);
        respFromRemote.body = new Buffer(str);
        respFromRemote.headers['content-length'] = respFromRemote.body.length.toString();
        log.warn('Response filter: new body length %d and modified body:\n%s', respFromRemote.body.length, str);
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

