const _ = require('lodash')
const axios = require('axios')
const HttpsProxyAgent = require('https-proxy-agent')

const { isIds } = require('./helpers')

class iAM48 {
  constructor (options) {
    Object.defineProperty(this, 'options', {
      enumerable: false,
      writable: true,
      value: _.merge({
        email: null,
        password: null,
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
    Object.defineProperty(this, 'axios', {
      enumerable: false,
      writable: true,
      value: axios.create({
        headers: {
          'user-agent': 'BNK48_102/1.2.52/Dalvik/2.1.0 (Linux; U; Android 5.1.1; LGM-V300K Build/JLS36C)',
          'Environment':	'PROD',
          'BNK48-App-Id':	'BNK48_102',
          'Connection':	'close',
          'BNK48-Device-Id':	'6802689067815614',
          'Accept-Language':	'th-TH',
          'BNK48-Device-Model':	'samsung LGM-V300K',
          'Host':	'user.bnk48.io'
        }
      })
    })
    Object.defineProperty(this, 'cache', {
      enumerable: false,
      writable: true,
      value: {}
    })
    if (this.options.proxy && this.options.proxy.host && this.options.proxy.port) {
      this.axios.defaults.proxy = false
      if (this.options.proxy.auth && this.options.proxy.auth.user && this.options.proxy.auth.pass) {
        this.axios.defaults.httpsAgent = new HttpsProxyAgent(`http://${this.options.proxy.auth.user}:${this.options.proxy.auth.pass}@${this.options.proxy.host}:${this.options.proxy.port}`)
      } else {
        this.axios.defaults.httpsAgent = new HttpsProxyAgent(`http://${this.options.proxy.host}:${this.options.proxy.port}`)
      }
      // console.log('set proxy', this.axios.defaults.httpsAgent)
    }
    // console.log(this.options, this.axios.defaults)
  }

  login () {
    return new Promise((resolve, reject) => {
      this.axios
        .post(
          'https://user.bnk48.io/auth/email',
          {
            email: this.options.email,
            password: this.options.password
          }
        )
        .then((res) => {
          this.auth = res.data
          this.axios.defaults.headers.common.Authorization = `Bearer ${this.auth.token}`
          this.axios
            .get(
              `https://user.bnk48.io/user/${this.auth.id}/profile`
            )
            .then((res) => {
              this.auth = _.omit(_.merge(this.auth, res.data), ['token', 'refreshToken', 'expireDate'])
              this.axios
                .get(
                  'https://public.bnk48.io/members/all'
                )
                .then((res) => {
                  _.each(res.data, (member) => {
                    this.cache[member.codeName] = member.id
                  })
                  resolve(this)
                }).catch(reject)
            })
            .catch(reject)
        })
        .catch(reject)
    })
  }

  setupIds (userIds) {
    return new Promise((resolve, reject) => {
      try {
        if (!_.isArray(userIds)) userIds = [userIds]
        if (_.isEmpty(userIds)) {
          userIds = _.map(_.filter(require('../member-ids.json'), (member) => {
            return member.official_user_id && !member.graduated_at
          }), (member) => {
            return member.official_user_id
          })
        }
        userIds = _.uniq(userIds)
        if (isIds(userIds)) {
          resolve(userIds)
        } else {
          userIds = _.map(userIds, (userId) => {
            if (this.cache[userId]) {
              return this.cache[userId]
            } else {
              throw new Error(`Member not found (${userId})`)
            }
          })
          resolve(userIds)
        }
      } catch (e) {
        reject(e)
      }
    })
  }

  user (userId) {
    return new Promise(async (resolve, reject) => {
      try {
        userId = await this.setupIds(userId).then((userIds) => userIds[0]).catch((e) => {
          throw e
        })
        this
          .axios
          .get(`https://public.bnk48.io/member/${userId}/profile`)
          .then((res) => {
            resolve(res.data)
          })
          .catch(reject)
      } catch (e) {
        reject(e)
      }
    })
  }

  posts (userIds, amount) {
    return new Promise(async (resolve, reject) => {
      try {
        userIds = await this.setupIds(userIds).catch(reject)
        if (amount === undefined) {
          amount = 10
        }
        const requests = _.map(userIds, (userId) => {
          return this.axios.get(`https://public.bnk48.io/timeline/only/member/${userId}?amount=${amount}`)
        })
        axios
          .all(requests)
          .then((responses) => {
            const posts = _.flatten(_.map(responses, (response) => {
              return response.data.feeds
            }))
            resolve(_.orderBy(posts, ['content.postedAt'], ['desc']))
          })
          .catch(reject)
      } catch (e) {
        reject(e)
      }
    })
  }

  stories (userIds) {
    return new Promise((resolve, reject) => {
      try {
        resolve([])
      } catch (e) {
        reject(e)
      }
    })
  }

  lives (userIds) {
    return new Promise(async (resolve, reject) => {
      try {
        userIds = await this.setupIds(userIds).catch(reject)
        this
          .axios
          .get('https://public.bnk48.io/schedules/member-live')
          .then((res) => {
            const isLives = _.filter(res.data, (live) => {
              return live.isLive && (_.size(userIds) === 0 || _.includes(userIds, live.memberId))
            })
            if (_.size(isLives)) {
              const requests = _.map(isLives, (live) => {
                return this.axios.get(`https://live-api.bnk48.io/user/${this.auth.id}/watch/member-live/${live.id}`)
              })
              axios
                .all(requests)
                .then((responses) => {
                  const lives =_.map(responses, (response, i) => {
                    isLives[i].live = response.data
                    return isLives[i]
                  })
                  resolve(lives)
                })
                .catch(reject)
            } else {
              resolve([])
            }
          })
          .catch(reject)
      } catch (e) {
        reject(e)
      }
    })
  }
}

module.exports = iAM48
