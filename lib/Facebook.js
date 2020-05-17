const querystring = require('querystring')
const _ = require('lodash')
const axios = require('axios')
const { v4: uuid } = require('uuid')
const HttpsProxyAgent = require('https-proxy-agent')

const { getObjects, isIds } = require('./helpers')

class Facebook {
  constructor (options) {
    Object.defineProperty(this, 'options', {
      enumerable: false,
      writable: true,
      value: _.merge({
        access_token: null,
        graph_version: '7.0',
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
          'authorization': `OAuth ${this.options.access_token}`,
          'user-agent': '[FBAN/FB4A;FBAV/270.0.0.38.127;FBBV/213611771;FBDM/{density=1.5,width=720,height=1280};FBLC/th_TH;FBRV/0;FBCR/Advanced Info Service;FBMF/samsung;FBBD/samsung;FBPN/com.facebook.katana;FBDV/LGM-V300K;FBSV/5.1.1;FBOP/1;FBCA/x86:armeabi-v7a;]'
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
        .get(
          `https://graph.facebook.com/v${this.options.graph_version}/me`
        )
        .then((res) => {
          this.auth = res.data
          resolve(this)
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
            return member.facebook_user_id && !member.graduated_at
          }), (member) => {
            return member.facebook_user_id
          })
        }
        userIds = _.uniq(userIds)
        if (isIds(userIds)) {
          resolve(userIds)
        } else {
          userIds = _.map(userIds, (userId) => {
            if (userId.toString().match(/^(\d+)$/)) {
              this.cache[userId] = userId
            }
            return this.cache[userId] || userId
          })
          const nonCached = _.filter(userIds, (userId) => {
            return !this.cache[userId] && !userId.toString().match(/^(\d+)$/)
          })
          if (_.size(nonCached)) {
            const chunkIds = _.chunk(nonCached, 50)
            const chunkRequests = _.chunk(chunkIds, 50)
            const batches = _.map(chunkRequests, (chunkRequestIds) => {
              return _.map(chunkRequestIds, (ids) => {
                return {
                  method: 'GET',
                  relative_url: `?ids=${ids.join(',')}`
                }
              })
            })
            const requests = _.map(batches, (batch) => {
              const params = querystring.stringify({
                batch: JSON.stringify(batch),
                include_headers: false
              })
              const url = `https://graph.facebook.com/v${this.options.graph_version}/?${params}`
              return this.axios.post(
                url
              )
            })
            axios.all(requests).then((responses) => {
              _.each(responses, (response) => {
                _.each(response.data, (result) => {
                  const users = JSON.parse(result.body)
                  if (users.error) {
                    throw new Error(users.error.message)
                  } else {
                    console.log(users)
                    _.each(users, (user, userId) => {
                      this.cache[userId] = user.id
                    })
                  }
                })
              })
              resolve(_.map(userIds, (userId) => {
                return this.cache[userId]
              }))
            }).catch((e) => {
              reject(e)
            })
          } else {
            resolve(userIds)
          }
        }
      } catch (e) {
        reject(e)
      }
    })
  }

  user (userId) {
    return new Promise((resolve, reject) => {
      try {
        this
          .axios
          .get(`https://graph.facebook.com/${userId}`)
          .then((res) => {
            resolve(res.data)
          })
          .catch(reject)
      } catch (e) {
        reject(e)
      }
    })
  }

  posts (userIds, limit, fields) {
    return new Promise(async (resolve, reject) => {
      try {
        userIds = await this.setupIds(userIds).catch(reject)
        if (limit === undefined) {
          limit = 10
        }
        if (fields === undefined) {
          fields = [
            'application',
            'attachments',
            'child_attachments',
            'created_time',
            'from',
            'full_picture',
            'status_type',
            'message',
            'message_tags',
            'parent_id',
            'properties',
            'story',
            'story_tags'
          ]
        }
        const chunkIds = _.chunk(userIds, 50)
        const chunkRequests = _.chunk(chunkIds, 50)
        const batches = _.map(chunkRequests, (chunkRequestIds) => {
          return _.map(chunkRequestIds, (ids) => {
            return {
              method: 'GET',
              relative_url: `posts?ids=${ids.join(',')}&locale=en_US&fields=${fields.join(',')}&limit=${limit}`
            }
          })
        })
        const requests = _.map(batches, (batch) => {
          const params = querystring.stringify({
            batch: JSON.stringify(batch),
            include_headers: false
          })
          const url = `https://graph.facebook.com/v${this.options.graph_version}/?${params}`
          return this.axios.post(
            url
          )
        })
        axios.all(requests).then((responses) => {
          const posts = _.flatten(_.map(responses, (response) => {
            return _.flatten(_.map(response.data, (result) => {
              const users = JSON.parse(result.body)
              if (users.error) {
                throw new Error(users.error.message)
              } else {
                return _.flatten(_.map(users, 'data'))
              }
            }))
          }))
          resolve(_.orderBy(_.filter(posts), ['created_time'], ['desc']))
        }).catch((e) => {
          reject(e)
        })
      } catch (e) {
        reject(e)
      }
    })
  }

  stories (userIds) {
    return new Promise(async (resolve, reject) => {
      try {
        userIds = await this.setupIds(userIds).catch(reject)
        const buckets = await Promise
          .allSettled(_.map(userIds, (userId) => {
            return this.$getBucketID(userId)
          }))
          .then((buckets) => {
            buckets = _.filter(_.map(buckets, 'value'))
            return _.flatten(buckets)
          })
          .catch(reject)
        const stories = await Promise
          .all(_.map(buckets, (bucketId) => {
            return this.$getStories(bucketId)
          }))
          .then((stories) => {
            return _.map(_.flatten(stories), (story) => {
              return _.pick(story, ['creation_time', 'attachments', 'actors'])
            })
          })
          .catch(reject)
        resolve(_.orderBy(_.filter(stories), ['creation_time', 'desc']))
      } catch (e) {
        reject(e)
      }
    })
  }

  lives (userIds) {
    return new Promise(async (resolve, reject) => {
      try {
        userIds = await this.setupIds(userIds).catch(reject)
        const lives = await Promise
          .all(_.map(userIds, (userId) => {
            return this.$getContents(userId)
          }))
          .then((lives) => {
            return _.map(_.flatten(lives), (live) => {
              return _.pick(live, ['creation_time', 'title', 'owner', 'playable_url'])
            })
          })
          .catch(reject)
        resolve(_.orderBy(_.filter(lives), ['creation_time', 'desc']))
      } catch (e) {
        reject(e)
      }
    })
  }

  $getBucketID (userId) {
    return new Promise((resolve, reject) => {
      try {
        const fbApiReqFriendlyName = 'PageTabContentDataQuery_At_Connection_Pagination_Page_cards_connection'
        const clientTraceId = uuid()
        const data = {
          doc_id: '3440496485980456',
          method: 'post',
          locale: 'en_US', // default = user
          pretty: false,
          format: 'json',
          purpose: 'fetch',
          fb_api_client_context: {
            load_next_page_counter: 3,
            client_connection_size: 7
          },
          variables: JSON.stringify({
            remove_attachment_feedback: false,
            ad_id: null,
            reading_attachment_profile_image_height: 203,
            question_poll_count: 100,
            msqrd_segmentation_model_version: 106,
            news_feed_only: false,
            include_surround_comment_ntview: true,
            defer_posts: false,
            include_related_living_rooms: false,
            include_messaging_in_iab: true,
            include_marketplace_ads_fields: false,
            is_replay_enabled: true,
            include_description: false,
            fetch_binary_tree: false,
            enable_private_reply: true,
            include_predicted_feed_topics: false,
            include_comments_disabled_fields: false,
            msqrd_target_recognition_model_version: 5,
            include_comment_parent_feedback: false,
            include_comment_depth: false,
            image_low_width: 240,
            include_can_buyer_message_from_comments: false,
            in_channel_eligibility_experiment: false,
            load_redundant_fields: false,
            image_medium_width: 360,
            num_friend_presence: 3,
            image_low_height: 2048,
            msqrd_supported_capabilities: [
              { value: JSON.stringify([
                { faceTracker: 14 },
                { segmentation: 106 },
                { handTracker: 5 },
                { targetRecognition: 5 }
              ]), name: 'capabilities_models_max_supported_versions'},
              { value: 14, name: 'face_tracker_version' },
              { value: 'segmentation_enabled', name:'segmentation' },
              { value: 'body_tracking_disabled', name: 'body_tracking' },
              { value: 'hand_tracking_enabled', name: 'hand_tracking' },
              { value: 'real_scale_estimation_disabled', name: 'real_scale_estimation' },
              { value: '66.0,67.0,68.0,69.0,70.0,71.0,72.0,73.0,74.0,75.0,76.0,77.0,78.0,79.0,80.0,81.0,82.0,83.0,84.0,85.0,86.0,87.0,88.0', name: 'supported_sdk_versions'},
              { value: 'etc2_compression', name: 'compression' },
              { value: 'world_tracker_enabled', name: 'world_tracker' },
              { value: 'gyroscope_enabled', name: 'gyroscope' },
              { value: 'hair_segmentation_disabled', name: 'hair_segmentation' },
              { value: 'xray_disabled', name: 'xray' }
            ],
            fetch_traditional_tree: true,
            enable_target_media_feedback_important_reactors: true,
            enable_friendship_status_on_actors: true,
            profile_pic_media_type: 'image/x-auto',
            fetch_reply_approximate_position: false,
            reading_attachment_profile_image_width: 135,
            should_fetch_share_count: false,
            reactors_scale: 3,
            include_comment_highlighted_reaction: false,
            include_merchant_rating: false,
            fetch_complete_feedback: false,
            include_ranking_signals: false,
            has_wem_private_sharing: false,
            should_fetch_comment_filtering_footer_string: false,
            fetch_fbc_header: true,
            msqrd_hand_tracking_model_version: 5,
            fetch_json_scalar: false,
            msqrd_xray_model_version: 5,
            scale: 1.5,
            fetch_page_aggregation_fields: false,
            should_fetch_comment_share_context: false,
            sticker_labels_enabled: false,
            cards_connection_at_stream_use_customized_batch: false,
            rich_text_posts_enabled: false,
            tracking_sub_accessor: false,
            video_owner_image_size: 50,
            video_start_time_enabled: false,
            should_fetch_estimated_viewer_count: false,
            should_fetch_container_story: false,
            media_type: 'image/jpeg',
            enable_comment_shares: false,
            use_default_actor: true,
            fetch_video_title_from_media: false,
            profile_image_size: 60,
            use_deprecated_can_viewer_like: true,
            comment_privacy_value: [],
            skip_sample_entities_fields: false,
            website_preview_enabled: false,
            size_style: 'contain-fit',
            cards_connection_first: 3, // default = 3
            should_fetch_public_conversations_context: false,
            enable_ranked_replies: true,
            should_include_friend_actions: false,
            automatic_photo_captioning_enabled: false,
            enable_hd: false,
            fetch_comment_inline_survey: false,
            enable_download: false,
            image_medium_height: 2048,
            feedback_include_cv_related_posts_count: false,
            seen_reactors_limit: 10,
            filter_comments: true,
            fetch_watch_topic_info: false,
            saved_lists_enabled: false,
            should_include_cix_nt_presentation: false,
            dont_load_templates: true,
            include_shareable_url: false,
            nt_context: {
              using_white_navbar: true,
              styles_id: '60994d977650344c28cf8b7254509f13',
              pixel_ratio: 1.5
            },
            paginationPK: userId,
            enable_unseen_reactors: false,
            is_fetching_reply_comment: false,
            default_image_scale: 1.5,
            angora_attachment_cover_image_size: 720,
            image_large_aspect_width: 720,
            request_meetup_all_members: true,
            include_page_has_taggable_products: false,
            surface: 'timeline',
            enable_comment_replies_most_recent: true,
            enable_important_reactors: true,
            enable_consumption_animation: false,
            poll_facepile_size: 60,
            enable_unseen_comments: false,
            is_work_build: false,
            poll_voters_count: 5,
            page_id: userId,
            action_location: 'feed',
            cards_connection_after_cursor: 26,
            context_item_icon_size: 48,
            num_content_items: 1,
            admin_preview: false,
            comment_replies_order: [
              'toplevel'
            ],
            should_include_friend_watch_count: false,
            disable_story_menu_actions: false,
            dont_fetch_video_social_context: false,
            msqrd_aml_facetracker_model_version: 14,
            enable_auto_comment_translation: false,
            unseen_reactors_limit: 10,
            enable_comment_reactions: true,
            enable_comment_reactions_icons: true,
            image_high_height: 2048,
            remove_feedback_information: false,
            fetch_available_comment_orderings: false,
            dont_fetch_creation_story: false,
            enable_comment_voting: false,
            image_high_width: 720,
            should_fetch_comment_explanation_footer_string: false,
            image_large_aspect_height: 372
          }),
          fb_api_req_friendly_name: fbApiReqFriendlyName,
          fb_api_caller_class: 'ConnectionManager',
          fb_api_analytics_tags: [
            'GraphServices',
            'At_Connection'
          ],
          client_trace_id: clientTraceId,
          server_timestamps: true
        }
        this
          .$graphservice(fbApiReqFriendlyName, data)
          .then((res) => {
            const cards = getObjects(res.data, 'camera_post_type', 'PAGE_STORY')
            if (_.size(cards)) {
              resolve(cards[0].id)
            } else {
              reject(`BucketID not found (${userId})`)
            }
          })
          .catch(reject)
      } catch (e) {
        reject(e)
      }
    })
  }

  $getStories (bucketId) {
    return new Promise((resolve, reject) => {
      try {
        const fbApiReqFriendlyName = 'FbStoriesUnifiedSingleBucketQuery'
        const data = {
          doc_id: '2966883370065768',
          method: 'post',
          locale: 'en_US', // default th_TH
          pretty: false,
          format: 'json',
          purpose: 'fetch',
          variables: JSON.stringify({
            msqrd_hand_tracking_model_version: 5,
            scale: 1.5,
            large_profile_pic_size: 180,
            nt_surface: 'STORIES_VIEWER_SHEET',
            width: 720,
            msqrd_supported_capabilities: [
              { value: JSON.stringify([
                { faceTracker: 14 },
                { segmentation: 106 },
                { handTracker: 5 },
                { targetRecognition: 5 }
              ]), name: 'capabilities_models_max_supported_versions' },
              { value: 14, name: 'face_tracker_version' },
              { value: 'segmentation_enabled', name: 'segmentation' },
              { value: 'body_tracking_disabled', name: 'body_tracking' },
              { value: 'hand_tracking_enabled', name: 'hand_tracking' },
              { value: 'real_scale_estimation_disabled', name: 'real_scale_estimation' },
              { value: '66.0,67.0,68.0,69.0,70.0,71.0,72.0,73.0,74.0,75.0,76.0,77.0,78.0,79.0,80.0,81.0,82.0,83.0,84.0,85.0,86.0,87.0,88.0', name: 'supported_sdk_versions' },
              { value: 'etc2_compression', name: 'compression' },
              { value: 'world_tracker_enabled', name: 'world_tracker' },
              { value: 'gyroscope_enabled', name: 'gyroscope' },
              { value: 'hair_segmentation_disabled', name: 'hair_segmentation' },
              { value: 'xray_disabled', name: 'xray' }
            ],
            bloks_version: '973ff0e26c5d0649eeabc02135c8f32674c7a3347bc4b5f3a0c4f9f86c609a3f',
            video_thumbnail_height: 448,
            video_thumbnail_width: 448,
            profile_image_size: 60,
            use_server_thumbnail: true,
            msqrd_target_recognition_model_version: 5,
            height: 1280,
            nt_context: {
              using_white_navbar: true,
              styles_id: '60994d977650344c28cf8b7254509f13',
              pixel_ratio: 1.5
            },
            msqrd_aml_facetracker_model_version: 14,
            msqrd_xray_model_version: 5,
            msqrd_segmentation_model_version: 106,
            should_include_first_media: true,
            bucket_id: bucketId
          }),
          fb_api_req_friendly_name: fbApiReqFriendlyName,
          fb_api_caller_class: 'graphservice',
          fb_api_analytics_tags: [
            'GraphServices'
          ],
          server_timestamps: true
        }
        this
          .$graphservice(fbApiReqFriendlyName, data)
          .then((res) => {
            // const stories = getObjects(res.data, 'story_card_type', 'PAGE_STORY')
            const stories = _.map(res.data.data.node.unified_stories.edges, 'node')
            resolve(stories)
          })
          .catch(reject)
      } catch (e) {
        reject(e)
      }
    })
  }

  $getContents (userId) {
    return new Promise((resolve, reject) => {
      try {
        const fbApiReqFriendlyName = 'PageTabContentDataQuery'
        const data = {
          doc_id: '2851340731581779',
          method: 'post',
          locale: 'th_TH',
          pretty: false,
          format: 'json',
          purpose: 'fetch',
          variables: JSON.stringify({
            include_messaging_in_iab: true,
            msqrd_segmentation_model_version: 106,
            image_medium_height: 2048,
            image_low_width: 240,
            image_medium_width: 360,
            image_large_aspect_width: 720,
            image_large_aspect_height: 372,
            media_type: 'image/jpeg',
            default_image_scale: 1.5,
            size_style: 'contain-fit',
            enable_comment_reactions: true,
            reading_attachment_profile_image_height: 203,
            msqrd_target_recognition_model_version: 5,
            profile_pic_media_type: 'image/x-auto',
            poll_facepile_size: 60,
            scale: 1.5,
            enable_comment_reactions_icons: true,
            image_high_width: 720,
            surface: 'channel_tab',
            image_high_height: 2048,
            question_poll_count: 100,
            page_id: userId,
            msqrd_supported_capabilities: [
              { value: JSON.stringify([
                { faceTracker: 14 },
                { segmentation: 106 },
                { handTracker: 5 },
                { targetRecognition: 5 }
              ]), name: 'capabilities_models_max_supported_versions' },
              { value: 14, name: 'face_tracker_version' },
              { value: 'segmentation_enabled', name: 'segmentation'},
              { value: 'body_tracking_disabled', name: 'body_tracking'},
              { value: 'hand_tracking_enabled', name: 'hand_tracking' },
              { value: 'real_scale_estimation_disabled', name: 'real_scale_estimation' },
              { value: '66.0,67.0,68.0,69.0,70.0,71.0,72.0,73.0,74.0,75.0,76.0,77.0,78.0,79.0,80.0,81.0,82.0,83.0,84.0,85.0,86.0,87.0,88.0', name: 'supported_sdk_versions' },
              { value: 'etc2_compression', name: 'compression' },
              { value: 'world_tracker_enabled', name: 'world_tracker' },
              { value: 'gyroscope_enabled', name: 'gyroscope' },
              { value: 'hair_segmentation_disabled', name: 'hair_segmentation' },
              { value: 'xray_disabled', name: 'xray' }
            ],
            cards_connection_at_stream_enabled: true,
            reading_attachment_profile_image_width: 135,
            msqrd_xray_model_version: 5,
            profile_image_size: 60,
            msqrd_aml_facetracker_model_version: 14,
            angora_attachment_cover_image_size: 720,
            action_location: 'feed',
            msqrd_hand_tracking_model_version: 5,
            fetch_fbc_header: true,
            poll_voters_count: 5,
            image_low_height: 2048,
            context_item_icon_size: 48,
            nt_context:{
              using_white_navbar: true,
              styles_id: '60994d977650344c28cf8b7254509f13',
              pixel_ratio: 1.5
            }
          }),
          fb_api_req_friendly_name: fbApiReqFriendlyName,
          fb_api_caller_class: 'graphservice',
          fb_api_analytics_tags: [
            'GraphServices',
            'At_Connection',
            'channel_tab'
          ],
          server_timestamps: true
        }
        this
          .$graphservice(fbApiReqFriendlyName, data)
          .then((res) => {
            const lines = res.data.split('\n')
            const results = _.map(lines, (line) => {
              return JSON.parse(line)
            })
            const liveTab = getObjects(results, 'content_card_type', 'CHANNEL_TAB_LIVE_VIDEO')
            if (liveTab) {
              const lives = getObjects(liveTab, 'broadcast_status', 'LIVE')
              resolve(lives)
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

  $graphservice (fbApiReqFriendlyName, data) {
    return new Promise((resolve, reject) => {
     try {
      const formData = querystring.stringify(data)
      this
        .axios
        .post(
          'https://graph.facebook.com/graphql?_nc_eh=23e8217cfa5540834d4887d7989984be',
          formData,
          {
            headers: {
              'content-type': 'application/x-www-form-urlencoded',
              'x-fb-friendly-name':	fbApiReqFriendlyName
            }
          }
        )
        .then(resolve)
        .catch(reject)
      } catch (e) {
        reject(e)
      }
    })
  }
}

module.exports = Facebook