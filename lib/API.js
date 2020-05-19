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
    Object.defineProperty(this, 'proxy', {
      enumerable: false,
      writable: true,
      value: undefined
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
    this.facebook = new Facebook(_.merge(this.options.facebook, { api: this, proxy: this.options.proxy }))
    this.instagram = new Instagram(_.merge(this.options.instagram, { api: this, proxy: this.options.proxy }))
    this.iam48 = new iAM48(_.merge(this.options.iam48, { api: this, proxy: this.options.proxy }))
  }

  ready () {
    return new Promise((resolve, reject) => {
      try {
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
      } catch (e) {
        reject(e)
      }
    })
  }

  ip () {
    return new Promise(async (resolve, reject) => {
      try {
        const proxyUrl = await this.getProxyURL()
        if (proxyUrl) {
          this.axios.defaults.httpsAgent = new HttpsProxyAgent(proxyUrl)
        }
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

  getFreeProxies (timeout) {
    return new Promise(async (resolve, reject) => {
      try {
        const a = axios.create()
        const pxs = await a
          .get(`https://api.proxyscrape.com/?request=displayproxies&proxytype=http&timeout=${timeout}&anonymity=elite&ssl=yes`)
          .then((res) => {
            const lines = _.filter(res.data.split('\r\n'))
            return _.map(lines, (line) => {
              return {
                host: line.split(':')[0],
                port: line.split(':')[1],
              }
            })
          })
          .catch(reject)
        const checked = []
        const apxs = _.map(pxs, (px) => {
          return new Promise((resolve2) => {
            const apx = axios.create({
              proxy: false,
              httpsAgent: new HttpsProxyAgent(`http://${px.host}:${px.port}`)
            })
            const source = axios.CancelToken.source()
            setTimeout(() => {
              source.cancel()
            }, timeout)
            apx.get('https://api.ipify.org?format=json', { cancelToken: source.token }).then(() => {
              // console.log('working', px)
              checked.push(px)
              // console.log('checked', `${_.size(checked)}/${_.size(pxs)}`)
              resolve2(px)
            }).catch(() => {
              checked.push(false)
              // console.log('checked', `${_.size(checked)}/${_.size(pxs)}`)
              resolve2(false)
            })
          })
        })
        Promise
          .all(apxs)
          .then((apxsr) => {
            resolve(_.shuffle(_.filter(apxsr)))
          })
          .catch((e) => {
            // console.log('error', e)
            resolve([])
          })
      } catch (e) {
        resolve([])
      }
    })
  }

  async getProxy () {
    if (this.options.proxy === false) {
      return
    } else if (this.options.proxy && this.options.proxy.host && this.options.proxy.port) {
      this.proxy = this.options.proxy
      return this.proxy
    } else {
      const proxies = await this.getFreeProxies(5000)
      return _.size(proxies) ? _.sample(proxies) : null
    }
  }

  async getProxyURL () {
    const proxy = await this.getProxy()
    let proxyURL
    if (proxy) {
      if (proxy.auth && proxy.auth.user && proxy.auth.pass) {
        proxyURL = `http://${proxy.auth.user}:${proxy.auth.pass}@${proxy.host}:${proxy.port}`
      } else {
        proxyURL = `http://${proxy.host}:${proxy.port}`
      }
    }
    // console.log({ proxyURL })
    return proxyURL
  }
}

module.exports = API
