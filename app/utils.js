const fs = require('fs').promises
const crypto = require('crypto')

module.exports = {
  async loadJson (file) {
    try {
      return JSON.parse(await fs.readFile(file, {encoding: 'utf8'}))
    } catch (e) {
      return null
    }
  },

  async saveJson (file, data) {
    await fs.writeFile(file, JSON.stringify(data, null, 2), {encoding: 'utf8'})
  },

  randomString (length) {
    return crypto.randomBytes(length / 2 + 1).toString('hex').substr(0, length)
  },

  md5 (data) {
    return crypto.createHash('md5').update(data).digest('hex')
  },

  acc (array) {
    return array.reduce((acc, val) => acc + val, 0)
  },

  isObject (object) {
    return object === Object(object)
  }
}
