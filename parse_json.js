
// Determines whether key/value transform_valation should be disabled for the given key name.
// Possible return types:
// boolean, true: always disable transform_valation of both key and value
// number: disable both if depth is less or equal to number
// array: each element describes a set of conditions that must all be met to disable transform_valation.
//     Each element is an object with the following optional properties indicating
//     required conditions to disable transform_valation.
//       maxDepth: depth must be less or equal to this number
//       api: api name must match
//       type: parent object must have a __type property that matches this string
//     Additionally, the following optional properties determine additional behavior when disabling is true:
//       recurse: recurse if the value is an object
//       convert: if the value is a string, parse it as JSON and substitute
var propNames = {
  'objectId':true,
  'createdAt':true,
  'updatedAt':true,
  '$nearSphere':true,
  '$maxDistance':true,
  'ACL':true,
  '__type':true,
  'iid':true,
  'uuid':true,
  'data': [{maxDepth:3, recurse:true, convert:true }],
  'classname':true,
  'className':true,
  'v':true,
  'includeRelationStub':true,
  'include': [{maxDepth:1, api: 'find', recurse:true, transform_value_as_key: true}],
  'limit': [{maxDepth:1, api: 'find'}],
  'session_token':true,
  '$in':true,
  '$nin':true,
  'commands': [{maxDepth:1, api: 'multi', recurse:true}],
  'op':true,
  'params': [{maxDepth:2, api: 'multi', recurse:true}],
  'result': [{maxDepth:1, recurse:true}],
  'results': [{maxDepth:2, recurse:true}],
  'name': [{maxDepth:2, api: 'upload_file'}, {type: 'File'}],
  'post_params':true,
  'post_url':true,
  'url':true,
  'username': true,
  'email': true,
  'user_password': true,
  'code': true,
  'error': true,
  'syncExp': true,
  'longitude':true,
  'latitude':true
};


function lookup(obj, key, api, depth) {
  var entry = propNames[key];
  if (!entry)
    return null;
  if (typeof entry === 'boolean')
    return {};
  var result = null;
  entry.forEach(function (el) {
    if (result)
      return; // already found a matching disabling condition
    if (el.maxDepth && depth > el.maxDepth)
      return;
    if (el.api && api !== el.api)
      return;
    if (el.type && (!obj['__type'] || obj['__type'] != el.type))
      return;
    result = el;
  });
  return result;
}

module.exports = function process_object (obj, transform_val, api, depth, transform_key) {
  if (Array.isArray(obj)) {
    obj.forEach(function (element) {
      if (typeof element === 'object')
        process_object(element, transform_val, api, depth, transform_key);
    });
  } else for (var key in obj) {
    var opc = lookup(obj, key, api, depth);
    var val = obj[key];
    var recurse = true;
    var transform_value_as_key = false;
    delete obj[key];
    if (opc) { // disable key transform_valation
      recurse = opc.recurse;
      transform_value_as_key = opc.transform_value_as_key;
      if (opc.convert && typeof val === 'string')
        val = JSON.parse(val);
    } else if (transform_key) { // enable key transform
      key = transform_key(key);
    }
    if (recurse) {
      if (typeof val === 'string')
        val = transform_value_as_key? transform_key(val):transform_val(val);
      else if (typeof val === 'object')
        process_object(val, transform_val, api, depth + 1, transform_key); 
    } 
    obj[key] = val;
  }
}
