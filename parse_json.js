
var propNames = {
  'objectId':1,
  'createdAt':1,
  'updatedAt':1,
  '$nearSphere':1,
  '$maxDistance':1,
  'ACL':1,
  '__type':1,
  'iid':1,
  'uuid':1,
  'data':1,
  'classname':1,
  'className':1,
  'v':1,
  'includeRelationStub':1,
  'include':'follow',
  'limit':1,
  'session_token':1,
  '$in':1,
  '$nin':1,
  'commands':'follow',
  'op':'follow',
  'params':'follow',
  'name':1,
  'post_params':1,
  'post_url':1,
  'url':1,
};

module.exports = function process_object (obj, transform, encoding) {
  for (key in obj) {
    var opc = propNames[key];
    var val = obj[key];
    if (!opc) {
      var type = typeof val;
      delete obj[key];
      key = transform(key);
      if (type === 'string') {
	val = transform(val);
      } else if (type === 'object') {
        process_object(val, transform, encoding); 
      }
      obj[key] = val;
    } else if (opc === 'follow') {
      process_object(val, transform, encoding); 
    }
  }
}
