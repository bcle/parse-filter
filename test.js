
var fs = require('fs');
var process_object = require('./parse_json')


path = process.argv[2];
api = process.argv[3];
var input = fs.readFileSync(path, 'utf8');
var obj = JSON.parse(input);
console.log(JSON.stringify(obj, null, 2));
console.log('----');
process_object(obj, transform, api, 1);
console.log(JSON.stringify(obj, null, 2));


function transform(input) {
   return '>>> ' + input + ' <<<';
}
