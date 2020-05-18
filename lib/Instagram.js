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
        if (!_.isArray(userIds)) userIds = [ userIds ]
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
                  // this.client
                  //   .user
                  //   .getIdByUsername(userId)
                  //   .then((id) => {
                  //     resolve2(this.cache[userId] = id)
                  //   })
                  //   .catch(reject2)
                  this
                  .getUserByUsername(userId)
                  .then((user) => {
                    resolve2(this.cache[userId] = user.id)
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
        // userId = await this.setupIds(userId).then((userIds) => userIds[0]).catch((e) => {
        //   throw e
        // })
        // const info = await this
        //   .client
        //   .user
        //   .info(userId)
        // if (info) {
        //   resolve(info)
        // } else {
        //   reject(new Error(`User not found ${userId}`))
        // }
        if (isIds([ userId ])) {
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
    return new Promise((resolve, reject) => {
      try {
        this
          .client
          .request
          .send({
            baseUrl: null,
            url: `https://www.instagram.com/${username}/`,
            method: 'GET',
            qs: {
              __a: 1
            }
          })
          .then((res) => {
            resolve(res.body.graphql.user)
          })
          .catch((e) => {
            if (e.response.statusCode === 200 && e.response.body) {
              resolve(e.response.body.graphql.user)
            } else {
              reject(e)
            }
          })
      } catch (e) {
        reject(e)
      }
    })
  }

  getUserByID (userId) {
    return new Promise((resolve, reject) => {
      try {
        this
          .client
          .request
          .send({
            baseUrl: null,
            url: `https://www.instagram.com/graphql/query/`,
            method: 'GET',
            qs: {
              query_hash: 'ad99dd9d3646cc3c0dda65debcd266a7',
              variables: JSON.stringify({
                user_id: userId,
                include_chaining: true,
                include_reel: true,
                include_suggested_users: false,
                include_logged_out_extras: false,
                include_highlight_reels: false,
                include_related_profiles: false,
                include_live_status: true
              })
            }
          })
          .then((res) => {
            this
              .getUserByUsername(res.body.data.user.reel.user.username)
              .then((res) => {
                resolve(res.body.graphql.user)
              })
              .catch(reject)
          })
          .catch(reject)
      } catch (e) {
        reject(e)
      }
    })
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
        this
          .client
          .request
          .send({
            baseUrl: null,
            url: `https://www.instagram.com/graphql/query/`,
            method: 'GET',
            qs: {
              query_hash: 'f5dc1457da7a4d3f88762dae127e0238',
              variables: JSON.stringify({
                reel_ids: userIds,
                tag_names: [],
                location_ids: [],
                highlight_reel_ids: [],
                precomposed_overlay: false,
                show_story_viewer_list: true,
                story_viewer_fetch_count: 50,
                story_viewer_cursor: '',
                stories_video_dash_manifest: false
              })
            }
          })
          .then((res) => {
            resolve(_.map(res.body.data.reels_media, 'items'))
          })
          .catch(reject)
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
                  .user(userId)
                  .then((user) => {
                    resolve2(_.map(user.edge_owner_to_timeline_media.edges, 'node'))
                  })
                  .catch(reject2)
                // Promise.resolve(
                //   this.client.feed.user(userId)
                // ).then((userFeed) => {
                //   // const stories = await userReelsMedia.items()
                //   resolve2(userFeed.items())
                // }).catch((e) => {
                //   throw e
                // })
                // const userFeed = await this.client.feed.user(userId)
                // if (userFeed) {
                //   resolve2(userFeed.items())
                // } else {
                //   resolve2([])
                // }
              } catch (e) {
                reject2(e)
              }
            })
          }))
          .then((userPosts) => {
            resolve(_.orderBy(_.filter(_.flatten(userPosts)), ['taken_at_timestamp'], ['desc']))
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
        Promise
          .all(_.map(chunkUserIds, (ids) => {
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
                  .getUserReelsMedia(ids)
                  .then((medias) => {
                    resolve2(medias)
                  })
                  .catch(reject2)
                // this
                //   .client
                //   .request
                //   .send({
                //     baseUrl: null,
                //     url: `https://www.instagram.com/graphql/query/`,
                //     method: 'GET',
                //     qs: {
                //       query_hash: 'f5dc1457da7a4d3f88762dae127e0238',
                //       variables: JSON.stringify({
                //         reel_ids: ids,
                //         tag_names: [],
                //         location_ids: [],
                //         highlight_reel_ids: [],
                //         precomposed_overlay: false,
                //         show_story_viewer_list: true,
                //         story_viewer_fetch_count: 50,
                //         story_viewer_cursor: '',
                //         stories_video_dash_manifest: false
                //       })
                //     }
                //   })
                //   .then((res) => {
                //     resolve2(_.flatten(_.map(res.body.data.reels_media, 'items')))
                //   })
                //   .catch(reject2)
              } catch (e) {
                reject2(e)
              }
            })
          }))
          .then((stories) => {
            stories = _.filter(_.flatten(stories))
            resolve(_.orderBy(stories, ['taken_at_timestamp'], ['desc']))
          })
          .catch(reject)

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

        // const chunkUserIds = _.chunk(userIds, 20)
        // Promise
        //   .all(_.map(chunkUserIds, (ids) => {
        //     return new Promise(async (resolve2, reject2) => {
        //       try {
        //         Promise.resolve(
        //           this.client.feed.reelsMedia({
        //             userIds: ids
        //           })
        //         ).then((userReelsMedia) => {
        //           // const stories = await userReelsMedia.items()
        //           resolve2(userReelsMedia.items())
        //         }).catch((e) => {
        //           throw e
        //         })
        //       } catch (e) {
        //         reject2(e)
        //       }
        //     })
        //   }))
        //   .then((stories) => {
        //     stories = _.filter(_.flatten(stories))
        //     resolve(_.orderBy(stories, ['taken_at'], ['desc']))
        //   })
        //   .catch(reject)

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
                const users = _.map(groups, (live) => {
                  return _.pick(
                    live.user, 
                    [
                      'id',
                      'username',
                      'full_name',
                      'is_private',
                      'profile_pic_url',
                      'is_verified'
                    ]
                  )
                })
                let usersStr = `@${broadcast.broadcast_owner.username}`
                if (_.size(users) > 1) {
                  const restUsers = _.join(
                    _.map(
                      _.filter(users, (user) => {
                        return user.id !== broadcast.broadcast_owner.pk
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
