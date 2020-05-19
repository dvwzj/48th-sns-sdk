const _ = require('lodash')
const allSettled = require('promise.allsettled')
const axios = require('axios')
const HttpsProxyAgent = require('https-proxy-agent')

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
    this.axios = axios.create()
    if (this.options.proxy && this.options.proxy.host && this.options.proxy.port) {
      this.axios.defaults.proxy = false
      if (this.options.proxy.auth && this.options.proxy.auth.user && this.options.proxy.auth.pass) {
        this.axios.defaults.httpsAgent = new HttpsProxyAgent(`http://${this.options.proxy.auth.user}:${this.options.proxy.auth.pass}@${this.options.proxy.host}:${this.options.proxy.port}`)
      } else {
        this.axios.defaults.httpsAgent = new HttpsProxyAgent(`http://${this.options.proxy.host}:${this.options.proxy.port}`)
      }
    }
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
  ip () {
    return new Promise((resolve, reject) => {
      try {
        this
          .axios
          .get('https://api.ipify.org?format=json')
          .then((res) => {
            resolve(res.data.ip)
          })
          .catch(reject)
      } catch (e) {
        reject(e)
      }
    })
  }
}

module.exports = API
