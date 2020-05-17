function getObjects(obj, key, val) {
  var objects = []
  for (var i in obj) {
    if (!obj.hasOwnProperty(i)) continue
    if (typeof obj[i] == 'object') {
      objects = objects.concat(getObjects(obj[i], key, val));
    } else if (i == key && obj[i] == val || i == key && val == '') {
      objects.push(obj)
    } else if (obj[i] == val && key == ''){
      if (objects.lastIndexOf(obj) == -1){
        objects.push(obj)
      }
    }
  }
  return objects
}

function getValues(obj, key) {
  var objects = []
  for (var i in obj) {
    if (!obj.hasOwnProperty(i)) continue
    if (typeof obj[i] == 'object') {
      objects = objects.concat(getValues(obj[i], key))
    } else if (i == key) {
      objects.push(obj[i])
    }
  }
  return objects
}

function getKeys(obj, val) {
  var objects = []
  for (var i in obj) {
    if (!obj.hasOwnProperty(i)) continue
    if (typeof obj[i] == 'object') {
      objects = objects.concat(getKeys(obj[i], val))
    } else if (obj[i] == val) {
      objects.push(i)
    }
  }
  return objects;
}

function isIds (ids) {
  return ids.length === ids.filter((id) => {
    return id.toString().match(/^(\d+)$/)
  }).length
}

module.exports = {
  getObjects,
  getValues,
  getKeys,
  isIds
}
