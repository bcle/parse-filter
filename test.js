
var fs = require('fs');
var path  = require('path');
var crypto  = require('crypto');
var process_object = require('./parse_json')

var enc_key_path = path.join(__dirname, 'aes_key.bin');
var enc_key = fs.readFileSync(enc_key_path);
var enc_algo = 'aes128';

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

path = process.argv[2];
api = process.argv[3];
var input = fs.readFileSync(path, 'utf8');
var obj = JSON.parse(input);
console.log(JSON.stringify(obj, null, 1));
console.log('----');
// process_object(obj, transform, api, 1);
process_object(obj, encrypt_val, api, 1, encrypt_key);
console.log(JSON.stringify(obj, null, 1));


function transform(input) {
   return '>>> ' + input + ' <<<';
}
