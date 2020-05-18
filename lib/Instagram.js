const _ = require('lodash')
const { IgApiClient } = require('instagram-private-api')

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
    this.client.state.generateDevice(this.options.user)
    if (this.options.proxy && this.options.proxy.host && this.options.proxy.port) {
      if (this.options.proxy.auth && this.options.proxy.auth.user && this.options.proxy.auth.pass) {
        this.client.state.proxyUrl = `http://${this.options.proxy.auth.user}:${this.options.proxy.auth.pass}@${this.options.proxy.host}:${this.options.proxy.port}`
      } else {
        this.client.state.proxyUrl = `http://${this.options.proxy.host}:${this.options.proxy.port}`
      }
      // console.log('set proxy', this.client.state.proxyUrl)
    }
    // console.log(this.options, this.client.state)
  }

  login () {
    return new Promise((resolve, reject) => {
      this.client
        .simulate
        .preLoginFlow()
        .then(() => {
          this.client
            .account
            .login(
              this.options.user,
              this.options.pass
            )
            .then((loggedInUser) => {
              this.auth = loggedInUser
              this.client
                .simulate
                .postLoginFlow()
                .then(() => {
                  resolve(this)
                })
                .catch(reject)
            })
            .catch(reject)
        })
        .catch(reject)
    })
  }

  setupIds (userIds) {
    return new Promise((resolve, reject) => {
      try {
        if (userIds === undefined) userIds = []
        if (!_.isArray(userIds)) userIds = [userIds]
        if (_.isEmpty(userIds)) {
          userIds = _.map(_.filter(require('../member-ids.json'), (member) => {
            return member.instagram_user_id && !member.graduated_at
          }), (member) => {
            return member.instagram_user_id
          })
        }
        userIds = _.uniq(userIds)
        if (isIds(userIds)) {
          resolve(userIds)
        } else {
          Promise
            .all(_.map(userIds, (userId) => {
              return new Promise((resolve2, reject2) => {
                if (userId.toString().match(/^(\d+)$/)) {
                  resolve2(userId)
                } else if (this.cache[userId]) {
                  resolve2(this.cache[userId])
                } else {
                  this.client
                    .user
                    .getIdByUsername(userId)
                    .then((id) => {
                      resolve2(this.cache[userId] = id)
                    })
                    .catch(reject2)
                }
              })
            }))
            .then(resolve)
            .catch(reject)
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
        const info = await this
          .client
          .user
          .info(userId)
        if (info) {
          resolve(info)
        } else {
          reject(new Error(`User not found ${userId}`))
        }
      } catch (e) {
        reject(e)
      }
    })
  }

  posts (userIds) {
    return new Promise(async (resolve, reject) => {
      try {
        userIds = await this.setupIds(userIds).catch(reject)
        Promise
          .all(_.map(userIds, (userId) => {
            return new Promise(async (resolve2, reject2) => {
              try {
                const userFeed = await this.client.feed.user(userId)
                if (userFeed) {
                  resolve2(userFeed.items())
                } else {
                  resolve2([])
                }
              } catch (e) {
                reject2(e)
              }
            })
          }))
          .then((userPosts) => {
            resolve(_.orderBy(_.filter(_.flatten(userPosts)), ['taken_at'], ['desc']))
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
        userIds = await this.setupIds(userIds).catch(reject)
        const chunkUserIds = _.chunk(userIds, 20)
        let stories = await Promise.all(_.map(chunkUserIds, (ids) => {
          return new Promise(async (resolve2) => {
            const userReelsMedia = await this.client.feed.reelsMedia({
              userIds: ids
            })
            if (userReelsMedia) {
              const stories = await userReelsMedia.items()
              resolve2(stories)
            } else {
              resolve2([])
            }
          })
        }))
        stories = _.filter(_.flatten(stories))
        resolve(_.orderBy(stories, ['taken_at'], ['desc']))

        // Promise
        //   .all(_.map(userIds, (userId) => {
        //     return new Promise(async (resolve2, reject2) => {
        //       try {
        //         this
        //           .client
        //           .request
        //           .send({
        //             url: `/api/v1/feed/user/${userId}/reel_media/`,
        //             method: 'GET'
        //           })
        //           .then((res) => {
        //             // console.log(res.body.items)
        //             resolve2(res.body.items)
        //           })
        //           .catch(reject2)
        //       } catch (e) {
        //         reject2(e)
        //       }
        //     })
        //   }))
        //   .then((userStories) => {
        //     resolve(_.orderBy(_.filter(_.flatten(userStories)), ['taken_at'], ['desc']))
        //   })
        //   .catch(reject)

        // Promise
        //   .all(_.map(userIds, (userId) => {
        //     return new Promise(async (resolve2, reject2) => {
        //       try {
        //         const userStoryFeed = await this.client.feed.userStory(userId)
        //         if (userStoryFeed) {
        //           resolve2(userStoryFeed.items())
        //         } else {
        //           resolve2([])
        //         }
        //       } catch (e) {
        //         reject2(e)
        //       }
        //     })
        //   }))
        //   .then((userStories) => {
        //     resolve(_.orderBy(_.filter(_.flatten(userStories)), ['taken_at'], ['desc']))
        //   })
        //   .catch(reject)
      } catch (e) {
        reject(e)
      }
    })
  }

  lives (userIds) {
    return new Promise(async (resolve, reject) => {
      try {
        userIds = await this.setupIds(userIds).catch(reject)
        Promise
          .all(_.map(userIds, (userId, i) => {
            return new Promise(async (resolve2, reject2) => {
              try {
                if (
                  this.options.proxy &&
                  this.options.proxy.host &&
                  this.options.proxy.host == 'p.webshare.io' &&
                  this.options.proxy.auth &&
                  this.options.proxy.auth.user &&
                  this.options.proxy.auth.user.endsWith('rotate')
                ) {
                  const rotateUser = this.options.proxy.auth.user.replace('rotate', (i % 10) + 1)
                  this.client.state.proxyUrl = `http://${rotateUser}:${this.options.proxy.auth.pass}@${this.options.proxy.host}:${this.options.proxy.port}`
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
                    resolve2(res.body.broadcast)
                  })
                  .catch(reject2)
              } catch (e) {
                reject2(e)
              }
            })
          }))
          .then((userLives) => {
            resolve(
              _.orderBy(
                _.map(
                  _.filter(_.flatten(userLives)),
                  (live) => {
                    return _.pick(
                      live,
                      [
                        'id',
                        'dash_playback_url',
                        'dash_abr_playback_url',
                        'dash_live_predictive_playback_url',
                        'viewer_count',
                        'broadcast_owner',
                        'published_time'
                      ]
                    )
                  }
                ),
                [
                  'published_time'
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
