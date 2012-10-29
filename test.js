
var fs = require('fs');
var path = require('path');
var process_object = require('./parse_json')


// var path = path.join(__dirname, 'test', 'anywall_find_request_2.json');
//var path = path.join(__dirname, 'test', 'anywall_create_request_conv.json');
path = process.argv[2];
var input = fs.readFileSync(path, 'utf8');
var obj = JSON.parse(input);
console.log(JSON.stringify(obj, null, 2));
console.log('----');
process_object(obj, transform);
console.log(JSON.stringify(obj, null, 2));


function transform(input) {
   return '>>> ' + input + ' <<<';
}
