const _ = require('lodash')
const { IgApiClient } = require('instagram-private-api')
// const HttpsProxyAgent = require('https-proxy-agent')
const IGS = require('figss')
const IGP = require('figps')
const IGU = require('figus')

const { isIds } = require('./helpers')

class Instagram {
  constructor (options) {
    Object.defineProperty(this, 'options', {
      enumerable: false,
      writable: true,
      value: _.merge({
        user: null,
        pass: null,
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
    Object.defineProperty(this, 'client', {
      enumerable: false,
      writable: true,
      value: new IgApiClient()
    })
    Object.defineProperty(this, 'cache', {
      enumerable: false,
      writable: true,
      value: {}
    })
    Object.defineProperty(this, 'members', {
      enumerable: false,
      writable: true,
      value: _.filter(require('../members.json'), (member) => {
        return member.instagram_user_id && !member.graduated_at
      })
    })
    Object.defineProperty(this, 'igs', {
      enumerable: false,
      writable: true,
      value: (new IGS()).serviceManager()
    })
    Object.defineProperty(this, 'igp', {
      enumerable: false,
      writable: true,
      value: (new IGP()).serviceManager()
    })
    Object.defineProperty(this, 'igu', {
      enumerable: false,
      writable: true,
      value: (new IGU()).serviceManager()
    })
    this.client.state.generateDevice(this.options.user)
    // if (this.options.proxy && this.options.proxy.host && this.options.proxy.port) {
    //   if (this.options.proxy.auth && this.options.proxy.auth.user && this.options.proxy.auth.pass) {
    //     this.client.state.proxyUrl = `http://${this.options.proxy.auth.user}:${this.options.proxy.auth.pass}@${this.options.proxy.host}:${this.options.proxy.port}`
    //   } else {
    //     this.client.state.proxyUrl = `http://${this.options.proxy.host}:${this.options.proxy.port}`
    //   }
    //   // console.log('set proxy', this.client.state.proxyUrl)
    // }
    // console.log(this.options, this.client.state)
  }

  login () {
    return new Promise(async (resolve, reject) => {
      const proxy = await this.options.api.getProxyURL()
      if (proxy) {
        this.client.state.proxyUrl = proxy
        this.igs.setProxy(proxy)
        this.igp.setProxy(proxy)
        this.igu.setProxy(proxy)
      }
      resolve(this)
      // this.client
      //   .simulate
      //   .preLoginFlow()
      //   .then(() => {
      //     this.client
      //       .account
      //       .login(
      //         this.options.user,
      //         this.options.pass
      //       )
      //       .then((loggedInUser) => {
      //         this.auth = loggedInUser
      //         this.client
      //           .simulate
      //           .postLoginFlow()
      //           .then(() => {
      //             resolve(this)
      //           })
      //           .catch(reject)
      //       })
      //       .catch(reject)
      //   })
      //   .catch(reject)
    })
  }

  setupIds (userIds) {
    return new Promise((resolve, reject) => {
      try {
        if (userIds === undefined) userIds = []
        if (!_.isArray(userIds)) userIds = [ userIds ]
        if (_.isEmpty(userIds)) {
          userIds = _.map(this.members, (member) => {
            return member.instagram_user_id
          })
          // console.log('using all members')
          resolve(userIds)
        } else {
          userIds = _.uniq(userIds)
          if (isIds(userIds)) {
            resolve(userIds)
          } else {
            Promise
              .all(_.map(userIds, (userId) => {
                return new Promise((resolve2, reject2) => {
                  // if (userId.toString().match(/^(\d+)$/)) {
                  //   resolve2(userId)
                  // } else if (this.cache[userId]) {
                  //   resolve2(this.cache[userId].instagram_user_id || this.cache[userId].pk)
                  // } else {
                  //   this
                  //     .getUserByUsername(userId)
                  //     .then((user) => {
                  //       resolve2(this.cache[userId] = user)
                  //     })
                  //     .catch(reject2)
                  // }
                  const memberFindId = _.find(this.members, {
                    instagram_user_id: userId
                  })
                  const memberFindUsername = _.find(this.members, {
                    instagram_username: userId
                  })
                  if (memberFindId || memberFindUsername) {
                    // console.log('using members', userId, (memberFindId || memberFindUsername).instagram_user_id)
                    resolve2((memberFindId || memberFindUsername).instagram_user_id)
                  } else {
                    this
                      .user(userId)
                      .then((user) => {
                        resolve2(user.pk)
                      })
                      .catch(reject2)
                  }
                })
              }))
              .then(resolve)
              .catch(reject)
          }
        }
      } catch (e) {
        reject(e)
      }
    })
  }

  setupUsernames (userIds) {
    return new Promise(async (resolve, reject) => {
      try {
        if (userIds === undefined) userIds = []
        if (!_.isArray(userIds)) userIds = [ userIds ]
        if (_.isEmpty(userIds)) {
          const usernames = _.map(this.members, (member) => {
            return member.instagram_username
          })
          // console.log('using all members')
          resolve(usernames)
        } else {
          userIds = _.uniq(userIds)
          Promise.all(
            _.map(userIds, (userId) => {
              return new Promise((resolve2, reject2) => {
                // if (isIds([ userId ])) {
                //   this
                //     .getUserByID(userId)
                //     .then((user) => {
                //       resolve2(user.username)
                //     })
                //     .catch(reject2)
                // } else {
                //   resolve2(userId)
                // }
                const memberFindId = _.find(this.members, {
                  instagram_user_id: userId
                })
                const memberFindUsername = _.find(this.members, {
                  instagram_username: userId
                })
                if (memberFindId || memberFindUsername) {
                  // console.log('using members', userId, (memberFindId || memberFindUsername).instagram_username)
                  resolve2((memberFindId || memberFindUsername).instagram_username)
                } else {
                  this
                    .user(userId)
                    .then((user) => {
                      resolve2(user.username)
                    })
                    .catch(reject2)
                }
              })
            })
          )
          .then(resolve)
          .catch(reject)
        }
      } catch (e) {
        reject(e)
      }
    })
  }

  getCookieJar () {
    return new Promise(async (resolve, reject) => {
      try {
        const cookieJar = await this.client.state.serializeCookieJar()
        resolve(cookieJar)
      } catch (e) {
        reject(e)
      }
    })
  }
  
  getCookie () {
    return new Promise(async (resolve, reject) => {
      try {
        const cookieJar = await this.getCookieJar()
        const cookie = _.join(_.map(cookieJar.cookies, (cookie) => {
          return `${cookie.key}=${cookie.value}`
        }), '; ')
        resolve(cookie)
      } catch (e) {
        reject(e)
      }
    })
  }

  user (userId) {
    return new Promise(async (resolve, reject) => {
      try {
        const usernameCached = _.find(this.cache, { username: userId })
        const userPKCached = _.find(this.cache, { pk: userId })
        if (usernameCached || userPKCached) {
          // console.log('using cached', userId, (usernameCached || userPKCached).username)
          resolve(usernameCached || userPKCached)
        } else if (isIds([ userId ])) {
          this
            .getUserByID(userId)
            .then(resolve)
            .catch(reject)
        } else {
          this
            .getUserByUsername(userId)
            .then(resolve)
            .catch(reject)
        }
      } catch (e) {
        reject(e)
      }
    })
  }

  getUserByUsername (username) {
    return new Promise(async (resolve, reject) => {
      try {
        const proxy = await this.options.api.getProxyURL()
        if (proxy) {
          this.client.state.proxyUrl = proxy
          this.igu.setProxy(proxy)
        }
        this
          .igu
          .get(username)
          .then(resolve)
          .catch(reject)
        // Promise
        //   .resolve(
        //     this
        //       .client
        //       .user
        //       .getIdByUsername(username)
        //   )
        //   .then((id) => {
        //     this
        //       .getUserByID(id)
        //       .then(resolve)
        //       .catch(reject)
        //   })
        //   .catch(reject)
      } catch (e) {
        reject(e)
      }
    })
  }

  getUserByID (userId) {
    return new Promise(async (resolve, reject) => {
      try {
        const proxy = await this.options.api.getProxyURL()
        if (proxy) {
          this.client.state.proxyUrl = proxy
        }
        Promise
          .resolve(
            this
              .client
              .user
              .info(userId)
          )
          .then((user) => {
            // console.log('saving cache', userId, user)
            resolve(this.cache[userId] = user)
          })
          .catch(reject)
      } catch (e) {
        reject(e)
      }
    })
  }

  clearCache () {
    this.cache = {}
    return this
  }

  getUserReelsMedia (userIds) {
    return new Promise(async (resolve, reject) => {
      try {
        if (!userIds) {
          throw new Error(`reel_ids is required`)
        }
        if (!_.isArray(userIds)) userIds = [ userIds ]
        userIds = await this.setupIds(userIds).catch((e) => {
          throw e
        })
        const proxy = await this.options.api.getProxyURL()
        if (proxy) {
          this.client.state.proxyUrl = proxy
        }
        Promise.resolve(
          this.client.feed.reelsMedia({
            userIds
          })
        ).then((userReelsMedia) => {
          resolve(userReelsMedia.items())
        }).catch(reject)
      } catch (e) {
        reject(e)
      }
    })
  }

  posts (userIds) {
    return new Promise(async (resolve, reject) => {
      try {
        const proxy = await this.options.api.getProxyURL()
        if (proxy) {
          this.client.state.proxyUrl = proxy
          this.igp.setProxy(proxy)
        }
        const usernames = await this.setupUsernames(userIds).catch(reject)
        const tasks = _.map(usernames, (username) => {
          return this.igp.get(username)
        })
        Promise
          .all(tasks)
          .then((results) => {
            const items = _.orderBy(_.filter(_.flatten(_.map(results, 'items'))), ['taken_at'], ['desc'])
            const users = _.filter(_.flatten(_.map(results, 'user')))
            resolve({ users, items })
          })
          .catch(reject)
      } catch (e) {
        reject(e)
      }
    })
  }

  stories (userIds) {
    return new Promise(async (resolve, reject) => {
      try {
        const proxy = await this.options.api.getProxyURL()
        if (proxy) {
          this.client.state.proxyUrl = proxy
          this.igs.setProxy(proxy)
        }
        const usernames = await this.setupUsernames(userIds).catch(reject)
        const tasks = _.map(usernames, (username) => {
          return this.igs.get(username)
        })
        Promise
          .all(tasks)
          .then((results) => {
            const items = _.orderBy(_.filter(_.flatten(_.map(results, 'items'))), ['taken_at'], ['desc'])
            const users = _.filter(_.flatten(_.map(results, 'user')))
            resolve({ users, items })
          })
          .catch(reject)
      } catch (e) {
        reject(e)
      }
    })
  }

  lives (userIds) {
    return new Promise(async (resolve, reject) => {
      try {
        userIds = await this.setupIds(userIds).catch(reject)
        // userIds = await this.setupUsernames(userIds, true).catch(reject)
        // console.log({ userIds })

        // Promise.all(
        //   _.map(userIds, (userId) => {
        //     return new Promise(async (resolve2, reject2) => {
        //       // const axios = _.clone(this.options.api.axios)
        //       const proxy = await this.options.api.getProxyURL()
        //       if (proxy) {
        //         // axios.defaults.httpsAgent = new HttpsProxyAgent(proxy)
        //         this.client.state.proxyUrl = proxy
        //       }
        //       // const cookie = await this.getCookie()

        //       this
        //         .client
        //         .request
        //         .send({
        //           url: `/api/v1/feed/user/${userId}/story`,
        //           method: 'GET',
        //           qs: {
        //             supported_capabilities_new: JSON.stringify(this.client.state.supportedCapabilities)
        //           },
        //         })
        //         .then((res) => {
        //           this
        //             .user(userId)
        //             .then((user) => {
        //               resolve2({ broadcast: res.body.broadcast, user })
        //             })
        //             .catch(reject2)
        //         })
        //         .catch(reject2)

        //       // axios
        //       //   .get(`https://i.instagram.com/api/v1/feed/user/${userId}/story`, {
        //       //     params: {
        //       //       supported_capabilities_new: JSON.stringify(this.client.state.supportedCapabilities)
        //       //     },
        //       //     headers: {
        //       //       'user-agent': this.client.state.webUserAgent,
        //       //       // 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.138 Safari/537.36',
        //       //       cookie
        //       //     }
        //       //   })
        //       //   .then((res) => {
        //       //     const { broadcast } = res.data
        //       //     this
        //       //       .user(userId)
        //       //       .then((user) => {
        //       //         resolve2({ broadcast, user })
        //       //       })
        //       //       .catch(reject2)
        //       //   })
        //       //   .catch(reject2)

        //       // axios
        //       //   .get(`https://www.instagram.com/${userId}/live/?__a=1`, {
        //       //     headers: {
        //       //       // 'accept': '*/*',
        //       //       // 'x-ig-app-id': this.client.state.fbAnalyticsApplicationId,
        //       //       // 'x-ig-www-claim': this.client.state.igWWWClaim,
        //       //       'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.138 Safari/537.36',
        //       //       cookie,
        //       //       // 'x-requested-with': XMLHttpRequest
        //       //     }
        //       //   })
        //       //   .then((res) => {
        //       //     console.log('data', res.data)
        //       //     // const { broadcast } = res.data
        //       //     // this
        //       //     //   .user(userId)
        //       //     //   .then((user) => {
        //       //     //     resolve2({ broadcast, user })
        //       //     //   })
        //       //     //   .catch(reject2)
        //       //   })
        //       //   .catch(reject2)

        //       // this
        //       //   .client
        //       //   .request
        //       //   .send({
        //       //     baseUrl: null,
        //       //     url: `https://www.instagram.com/${username}/live/`,
        //       //     method: 'GET',
        //       //     qs: {
        //       //       __a: 1
        //       //     },
        //       //   })
        //       //   .then((res) => {
        //       //     console.log('data', res)
        //       //   })
        //       //   .catch((e) => {
        //       //     console.log('error', e.message)
        //       //     // const headers = _.omit(e.response.request.headers, ['Connection', 'referer'])
        //       //     this
        //       //       .options
        //       //       .api
        //       //       .axios
        //       //       .get(e.response.request.headers.referer, {
        //       //         headers: {
        //       //           cookie: e.response.request.headers.cookie
        //       //         }
        //       //       })
        //       //       .then((res) => {
        //       //         console.log('data', res.data)
        //       //       })
        //       //       .catch((e) => {
        //       //         console.log('still error', e.message)
        //       //       })
        //       //   })
        //     })
        //   })
        // )
        // .then((userLives) => {
        //     const lives = _.map(
        //       _.groupBy(
        //         _.filter(_.flatten(userLives), 'broadcast'),
        //         'broadcast.id'
        //       ), (groups) => {
        //         const { broadcast } = groups[0]
        //         const users = _.map(groups, 'user')
        //         let usersStr = `@${broadcast.broadcast_owner.username}`
        //         if (_.size(users) > 1) {
        //           const restUsers = _.join(
        //             _.map(
        //               _.filter(users, (user) => {
        //                 return user.pk !== broadcast.broadcast_owner.pk
        //               }),
        //               (user) => {
        //                 return `@${user.username}`
        //               }
        //             ),
        //             ', '
        //           )
        //           usersStr += ` & ${restUsers}`
        //         }
        //         return { broadcast, users, users_str: usersStr }
        //       }
        //     )
        //     resolve(
        //       _.orderBy(
        //         _.map(
        //           lives,
        //           (live) => {
        //             return _.pick(
        //               live,
        //               [
        //                 'broadcast.id',
        //                 'broadcast.dash_playback_url',
        //                 'broadcast.dash_abr_playback_url',
        //                 'broadcast.dash_live_predictive_playback_url',
        //                 'broadcast.viewer_count',
        //                 'broadcast.broadcast_owner',
        //                 'broadcast.published_time',
        //                 'users',
        //                 'users_str'
        //               ]
        //             )
        //           }
        //         ),
        //         [
        //           'broadcast.published_time'
        //         ],
        //         [
        //           'desc'
        //         ]
        //       )
        //     )
        //   })
        //   .catch(reject)

        Promise
          .all(_.map(userIds, (userId) => {
            return new Promise(async (resolve2, reject2) => {
              try {
                const proxy = await this.options.api.getProxyURL()
                if (proxy) {
                  this.client.state.proxyUrl = proxy
                }
                this
                  .client
                  .request
                  .send({
                    url: `/api/v1/feed/user/${userId}/story`,
                    method: 'GET',
                    qs: {
                      supported_capabilities_new: JSON.stringify(this.client.state.supportedCapabilities)
                    },
                  })
                  .then((res) => {
                    this
                      .user(userId)
                      .then((user) => {
                        resolve2({ broadcast: res.body.broadcast, user })
                      })
                      .catch(reject2)
                  })
                  .catch(reject2)
              } catch (e) {
                reject2(e)
              }
            })
          }))
          .then((userLives) => {
            const lives = _.map(
              _.groupBy(
                _.filter(_.flatten(userLives), 'broadcast'),
                'broadcast.id'
              ), (groups) => {
                const { broadcast } = groups[0]
                const users = _.map(groups, 'user')
                let usersStr = `@${broadcast.broadcast_owner.username}`
                if (_.size(users) > 1) {
                  const restUsers = _.join(
                    _.map(
                      _.filter(users, (user) => {
                        return user.pk !== broadcast.broadcast_owner.pk
                      }),
                      (user) => {
                        return `@${user.username}`
                      }
                    ),
                    ', '
                  )
                  usersStr += ` & ${restUsers}`
                }
                return { broadcast, users, users_str: usersStr }
              }
            )
            resolve(
              _.orderBy(
                _.map(
                  lives,
                  (live) => {
                    return _.pick(
                      live,
                      [
                        'broadcast.id',
                        'broadcast.dash_playback_url',
                        'broadcast.dash_abr_playback_url',
                        'broadcast.dash_live_predictive_playback_url',
                        'broadcast.viewer_count',
                        'broadcast.broadcast_owner',
                        'broadcast.published_time',
                        'users',
                        'users_str'
                      ]
                    )
                  }
                ),
                [
                  'broadcast.published_time'
                ],
                [
                  'desc'
                ]
              )
            )
          })
          .catch(reject)
      } catch (e) {
        reject(e)
      }
    })
  }
}

module.exports = Instagram
