/*
cron "0 9 * * *" oclean.js, tag=欧可琳牙刷签到
*/

const axios = require('axios')
const notify = require('../sendNotify')
const { initInstance, getEnv, updateCkEnv } = require('./qlApi.js')

let headers = {
  Host: 'careapi.oclean.com',
  AppVersion: ' 4.0.3',
  Connection: 'keep-alive',
  Accept: '*/*',
  'User-Agent': ' OcleanCare/1 CFNetwork/1408.0.4 Darwin/22.5.0',
  Authorization: '',
  'Accept-Language': 'zh-CN,zh-Hans;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br'
}

const getUrl = api => {
  return `https://careapi.oclean.com/mall/v1${api}`
}

// 获取环境变量
async function getRefreshToken() {
  let instance = null
  try {
    instance = await initInstance()
  } catch (e) {}

  let refreshToken = process.env.refreshToken || []
  try {
    if (instance) refreshToken = await getEnv(instance, 'OCLEAN')
  } catch (e) {}

  let refreshTokenArray = []

  if (Array.isArray(refreshToken)) refreshTokenArray = refreshToken
  else if (refreshToken.indexOf('&') > -1)
    refreshTokenArray = refreshToken.split('&')
  else if (refreshToken.indexOf('\n') > -1)
    refreshTokenArray = refreshToken.split('\n')
  else refreshTokenArray = [refreshToken]

  if (!refreshTokenArray.length) {
    console.log('未获取到refreshToken, 程序终止')
    process.exit(1)
  }

  return {
    instance,
    refreshTokenArray
  }
}

// 获取 accessToken
const getRefreshAccessToken = async () => {
  try {
    const { data } = await axios(getUrl('/SignIn/RefreshAccessToken'), {
      method: 'GET',
      data: {},
      headers: headers
    })

    return {
      access_token: `Bearer ${data.data.accessToken}`,
      refresh_token: data.data.refreshToken
    }
  } catch (error) {
    console.log(error, 'getRefreshAccessToken错误')
  }
}

// 获取签到信息
const getCheckInfo = async accessToken => {
  try {
    const { data } = await axios(getUrl('/CheckIn/GetCheckInfo'), {
      method: 'GET',
      data: {},
      headers: {
        ...headers,
        Authorization: accessToken
      }
    })
    console.log(data.data)
    return data.data
  } catch (error) {
    console.log(error, 'getCheckInfo错误')
  }
}

/**
 *
 * @param {*} accessToken
 * @param {*} checkType 0:签到 1:补签
 * @param {*} whichDay 签到下标（周几）
 */
const checkIn = async (accessToken, checkType, whichDay) => {
  try {
    const { data } = await axios(getUrl('/CheckIn/CheckIn'), {
      method: 'POST',
      data: { checkType: checkType, whichDay },
      headers: {
        ...headers,
        Authorization: accessToken
      }
    })

    return data.data.copywriting
  } catch (error) {}
}

!(async () => {
  const { instance, refreshTokenArray } = await getRefreshToken()

  const message = [dateNow, info]
  let index = 1
  for await (refreshToken of refreshTokenArray) {
    let remarks = refreshToken.remarks || `账号${index}`

    headers.Authorization = `Bearer ${refreshToken.value || refreshToken}`

    try {
      const { access_token, refresh_token } = await getRefreshAccessToken()

      // 更新环境变量
      if (instance) {
        let params = {
          name: refreshToken.name,
          value: refresh_token,
          remarks: refreshToken.remarks || remarks
        }
        // 新版青龙api
        if (refreshToken.id) {
          params.id = refreshToken.id
        }
        // 旧版青龙api
        if (refreshToken._id) {
          params._id = refreshToken._id
        }
        await updateCkEnv(instance, params)
      }

      const { dateNow, dateNowIndex } = await getCheckInfo(access_token)
      const info = await checkIn(access_token, 0, dateNowIndex)

      let sendMessage = `${dateNow}，${remarks}，${info}`

      console.log(sendMessage)
      console.log('\n')
      message.push(sendMessage)
    } catch (e) {
      console.log(e)
      console.log('\n')
      message.push(e)
    }
    index++
  }

  await notify.sendNotify(`欧可琳牙刷签到`, message.join('\n'))
})()
