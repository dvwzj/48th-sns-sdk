require('dotenv').config()

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

// const fs = require('fs')
// const util = require('util')
// const axios = require('axios')
// const HttpsProxyAgent = require('https-proxy-agent')
const _ = require('lodash')
// const moment = require('moment-timezone')

const API = require('./index')

async function test () {
  // const api = new API({
  //   facebook: {
  //     access_token: process.env.FACEBOOK_ACCESS_TOKEN,
  //     graph_version: process.env.FACEBOOK_GRAPH_VERSION
  //   },
  //   instagram: {
  //     user: process.env.INSTAGRAM_USER,
  //     pass: process.env.INSTAGRAM_PASS
  //   },
  //   iam48: {
  //     email: process.env.IAM48_EMAIL,
  //     password: process.env.IAM48_PASSWORD
  //   },
  //   proxy: {
  //     host: process.env.PROXY_HOST,
  //     port: process.env.PROXY_PORT,
  //     auth: {
  //       user: process.env.PROXY_USER,
  //       pass: process.env.PROXY_PASS
  //     }
  //   },
  //   webshare: {
  //     rotate: true,
  //     amount: 100,
  //     index: 1
  //   }
  // })

  // await api
  //   .ready()
  //   .then((results) => {
  //     console.log('api ready', results)
  //   })
  //   .catch((e) => {
  //     console.log('api error')
  //     console.error(e)
  //     process.exit()
  //   })
  
  // const ip = await api.ip()
  // console.log({ ip })
  // process.exit()
  // await api
  //   .facebook
  //   .posts(
  //     [
  //       // 'bnk48official.tarwaan',
  //       // 'cgm48official.kaning'
  //     ]
  //   )
  //   .then((posts) => {
  //     console.log('fb posts', _.size(posts) /* util.inspect(posts, false, null, true)*/)
  //   })
  //   .catch((e) => {
  //     console.error(e)
  //   })

  // await api
  //   .facebook
  //   .stories(
  //     [
  //       // 'bnk48official.tarwaan',
  //       // 'cgm48official.kaning'
  //     ]
  //   )
  //   .then((stories) => {
  //     console.log('fb stories', _.size(stories) /* util.inspect(stories, false, null, true)*/)
  //   })
  //   .catch((e) => {
  //     console.error(e)
  //   })

  // await api
  //   .facebook
  //   .lives(
  //     [
  //       // 'bnk48official.tarwaan',
  //       // 'cgm48official.kaning'
  //     ]
  //   )
  //   .then((lives) => {
  //     console.log('fb lives', lives /* util.inspect(lives, false, null, true)*/)
  //   })
  //   .catch((e) => {
  //     console.error(e)
  //   })

  await api
    .instagram
    .posts(
      [
        'tarwaan.bnk48office',
        // 'kaning.cgm48official'
      ]
    )
    .then((posts) => {
      console.log('ig posts', posts /* util.inspect(posts, false, null, true)*/)
    })
    .catch((e) => {
      console.error(e)
    })

  await api
    .instagram
    .stories(
      [
        'tarwaan.bnk48office',
        // 'kaning.cgm48official',
      ]
    )
    .then((stories) => {
      console.log('ig stories', stories /* util.inspect(stories, false, null, true)*/)
    })
    .catch((e) => {
      console.error(e)
    })

  await api
    .instagram
    .lives(
      [
        'tarwaan.bnk48office',
        // 'kaning.cgm48official',
      ]
    )
    .then((lives) => {
      console.log('ig lives', lives /* util.inspect(lives, false, null, true)*/)
    })
    .catch((e) => {
      console.error(e)
    })

  // await api
  //   .iam48
  //   .posts(
  //     [
  //       // 'tarwaan',
  //       // 'kaning'
  //     ]
  //   )
  //   .then((posts) => {
  //     console.log('iam posts', _.size(posts) /* util.inspect(posts, false, null, true)*/)
  //   })
  //   .catch((e) => {
  //     console.error(e)
  //   })

  // await api
  //   .iam48
  //   .lives(
  //     [
  //       // 'tarwaan',
  //       // 'cherprang'
  //     ]
  //   )
  //   .then((lives) => {
  //     console.log('iam lives', lives /*util.inspect(lives, false, null, true)*/)
  //   })
  //   .catch((e) => {
  //     console.error(e)
  //   })

  // // axios.get('https://api.48th.ml/iam48-members/items/members?access_token=' + process.env.DIRECTUS_TOKEN).then((res) => {
  // //   // console.log(res.data.data)
  // //   const members = _.map(res.data.data, (member) => {
  // //     return _.pick(member, ['slug', 'official_user_id', 'facebook_user_id', 'instagram_user_id', 'graduated_at'])
  // //   })
  // //   fs.writeFileSync('member-ids.json', JSON.stringify(members, null, 2))
  // // }).catch((e) => {
  // //   console.error(e)
  // // })

  // await api
  //   .facebook
  //   .user('bnk48official.tarwaan')
  //   .then((user) => {
  //     console.log('fb user', user)
  //   })
  //   .catch((e) => {
  //     console.error(e)
  //   })

  // await api
  //   .instagram
  //   .user('tarwaan.bnk48office')
  //   .then((user) => {
  //     console.log('ig user', user)
  //   })
  //   .catch((e) => {
  //     console.error(e)
  //   })

  // await api
  //   .iam48
  //   .user('tarwaan')
  //   .then((user) => {
  //     console.log('iam user', user)
  //   })
  //   .catch((e) => {
  //     console.error(e)
  //   })
}

test()