const _ = require('lodash')
const allSettled = require('promise.allsettled')

const Facebook = require('./Facebook')
const Instagram = require('./Instagram')
const iAM48 = require('./iAM48')

class API {
  constructor (options) {
    allSettled.shim()
    Object.defineProperty(this, 'options', {
      enumerable: false,
      writable: true,
      value: _.merge({
        facebook: {
          access_token: null,
          graph_version: null
        },
        instagram: {
          user: null,
          pass: null
        },
        iam48: {
          email: null,
          password: null
        },
        proxy: {
          host: null,
          port: null,
          auth: {
            user: null,
            pass: null
          }
        }
      }, options)
    })
    this.facebook = new Facebook(_.merge(this.options.facebook, { proxy: this.options.proxy }))
    this.instagram = new Instagram(_.merge(this.options.instagram, { proxy: this.options.proxy }))
    this.iam48 = new iAM48(_.merge(this.options.iam48, { proxy: this.options.proxy }))
  }

  ready () {
    return new Promise((resolve, reject) => {
      Promise
      .all([
        this.facebook.login(),
        this.instagram.login(),
        this.iam48.login(),
      ])
      .then((results) => {
        resolve(results)
      })
      .catch((e) => {
        reject(e)
      })
    })
  }
}

module.exports = API
