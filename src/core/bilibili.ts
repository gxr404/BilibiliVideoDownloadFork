import pLimit from 'p-limit'
import { formatSecond, randUserAgent, getWbiKeys, encWbi, formatFileName, filterTitle } from '../utils'
import { qualityMap } from '../assets/data/quality'
import { VideoData, Page, DownloadUrl, Subtitle, TaskData } from '../type'
import { store, pinia } from '../store'
import { STATUS } from '../assets/data/status'
import { nanoid } from '@/utils'

/**
 * @params videoInfo: 当前下载的视频详情 selected：所选的分p quality：所选的清晰度
 * @returns 返回下载数据 Array
 */
const getDownloadList = async (videoInfo: VideoData, selected: number[], quality: number, isReload = false, oldTask?: VideoData, saveFilePrefix = true) => {
  const downloadList: VideoData[] = []
  const limit = pLimit(8)
  const selectedLen = selected.length
  const promiseList = selected.map((item) => {
    return limit(async () => {
      const currentPage = item
      // 请求选中清晰度视频下载地址
      const currentPageData = videoInfo.page.find(item => item.page === currentPage)
      if (!currentPageData) throw new Error('获取视频下载地址错误')
      const currentCid = currentPageData.cid
      const currentBvid = currentPageData.bvid
      // 获取下载地址
      // 判断当前数据是否有下载地址列表，有则直接用，没有再去请求
      const downloadUrl: DownloadUrl = { video: '', audio: '' }
      const videoUrl = videoInfo.video.find(item => item.id === quality && item.cid === currentCid)
      const audioUrl = getHighQualityAudio(videoInfo.audio)
      // console.log('videoInfo', videoInfo)
      // console.log('audio url', audioUrl)
      // await getDownloadUrl(currentCid, currentBvid, quality)
      // console.log('(currentCid, currentBvid, quality)', currentCid, currentBvid, quality)
      let fixQuality = quality
      if (videoUrl && audioUrl) {
        downloadUrl.video = videoUrl.url
        downloadUrl.audio = audioUrl.url
      } else {
        const { video, audio, quality: realQuality } = await getDownloadUrl(currentCid, currentBvid, quality)
        downloadUrl.video = video
        downloadUrl.audio = audio
        fixQuality = realQuality
        // throw new Error('获取视频下载地址错误')
      }
      console.log('[render downloadUrl]: ', downloadUrl)
      // 获取字幕地址
      const subtitle = await getSubtitle(currentCid, currentBvid)
      let taskId = nanoid()
      if (isReload && oldTask) {
        taskId = oldTask.id
      }
      const videoType = checkUrl(currentPageData.url)
      const { body, url } = await checkUrlRedirect(currentPageData.url)
      const curPageVideoInfo = await parseHtml(body, videoType, url)
      let tempVideoInfo = videoInfo
      if (curPageVideoInfo !== -1) {
        tempVideoInfo = {
          ...videoInfo,
          ...curPageVideoInfo
        }
      }
      const videoData: VideoData = {
        ...tempVideoInfo,
        id: taskId,
        title: currentPageData.title,
        url: currentPageData.url,
        quality: fixQuality || quality,
        duration: currentPageData.duration,
        createdTime: +new Date(),
        cid: currentCid,
        bvid: currentBvid,
        downloadUrl,
        filePathList: handleFilePathList(selectedLen === 1 && !isReload ? 0 : currentPage, currentPageData.title, tempVideoInfo, currentBvid, taskId, saveFilePrefix),
        fileDir: handleFileDir(selectedLen === 1 && !isReload ? 0 : currentPage, currentPageData.title, tempVideoInfo, currentBvid, taskId, saveFilePrefix),
        subtitle
      }
      downloadList.push(videoData)
    })
  })
  await Promise.all(promiseList)
  return downloadList
}

const addDownload = (videoList: VideoData[] | TaskData[]) => {
  const allowDownloadCount =
    store.settingStore(pinia).downloadingMaxSize - store.baseStore(pinia).downloadingTaskCount
  const taskList: TaskData[] = []
  if (allowDownloadCount >= 0) {
    videoList.forEach((item, index) => {
      if (index < allowDownloadCount) {
        taskList.push({
          ...item,
          status: STATUS.PLAN_START,
          progress: 0
        })
      } else {
        taskList.push({
          ...item,
          status: STATUS.PENDING,
          progress: 0
        })
      }
    })
  }
  return taskList
}

/**
 *
 * @returns 保存cookie中的bfe_id
 */
const saveResponseCookies = (cookies: string[]) => {
  // console.log('cookies', cookies)
  if (cookies && cookies.length) {
    const cookiesString = cookies.join(';')
    console.log('bfe: ', cookiesString)
    store.settingStore(pinia).setBfeId(cookiesString)
  }
}

interface ICheckLoginRes {
  status: 0 | 1 | 2,
  face: ''
}

/**
 *
 * @returns 0: 游客，未登录 1：普通用户 2：大会员
 */
const checkLogin = async (SESSDATA: string) => {
  const { body } = await window.electron.got('https://api.bilibili.com/x/web-interface/nav', {
    headers: {
      'User-Agent': randUserAgent(),
      cookie: `SESSDATA=${SESSDATA}`
    },
    responseType: 'json'
  })
  const data: ICheckLoginRes = {
    status: 0,
    face: ''
  }
  if (body.data.isLogin && !body.data.vipStatus) {
    data.status = 1
    data.face = body.data.face
  } else if (body.data.isLogin && body.data.vipStatus) {
    data.status = 2
    data.face = body.data.face
  }
  return data
}

// 检查url合法
const checkUrl = (url: string) => {
  if (!(/^(https?):\/\//.test(url))) return ''
  const mapUrl = [
    // url 带有video/av 或 video/BV
    {
      reg: /.*(video\/BV|video\/av)/,
      type: 'BV'
    },
    // url 带有play/ss
    {
      reg: /.*play\/ss/,
      type: 'ss'
    },
    // url 带有play/ep
    {
      reg: /.*play\/ep/,
      type: 'ep'
    },
    {
      // url 带有 list/数字
      reg: /.*list\/.*/,
      type: 'list'
    }
  ]
  const findType = mapUrl.find(item => {
    return item.reg.test(url)
  })
  return findType ? findType.type : ''
}

// 检查url是否有重定向
const checkUrlRedirect = async (videoUrl: string) => {
  const ua = randUserAgent()
  const params = {
    videoUrl,
    config: {
      headers: {
        'User-Agent': ua,
        cookie: `SESSDATA=${store.settingStore(pinia).SESSDATA}`
      }
    }
  }
  const { body, redirectUrls } = await window.electron.got(params.videoUrl, params.config)
  const url = redirectUrls[0] ? redirectUrls[0] : videoUrl
  return {
    body,
    url
  }
}

const parseHtml = (html: string, type: string, url: string) => {
  switch (type) {
    case 'BV':
      return parseBV(html, url)
    case 'ss':
      // return parseSS(html)
      return parseEP(html, url)
    case 'ep':
      return parseEP(html, url)
    case 'list':
      return parseList(html, url)
    default:
      return -1
  }
}

const parseBV = async (html: string, url: string) => {
  console.log('[render parseBV]: ', url)
  try {
    const videoInfo = html.match(/\<script\>window\.\_\_INITIAL\_STATE\_\_\=([\s\S]*?)\;\(function\(\)/)
    if (!videoInfo) throw new Error(`parse bv error [videoInfo]: ${url}`)
    const videoInfoData = JSON.parse(videoInfo[1])
    let videoData = videoInfoData.videoData
    // 2025-06-15
    // 特殊情况:  https://www.bilibili.com/video/BV1RSTEzjEpL BV没有videoData
    if (!videoData && videoInfoData.videoInfo) {
      const _videoInfo = videoInfoData.videoInfo
      videoData = Object.assign({
        stat: {
          view: _videoInfo?.viewCount,
          danmaku: _videoInfo?.danmakuCount,
          reply: undefined
        },
        owner: {
          name: _videoInfo?.upName,
          mid: _videoInfo?.upMid
        }
      }, _videoInfo)

      if (Array.isArray(videoInfoData?.sectionEpisodes)) {
        const findItem = videoInfoData?.sectionEpisodes.find((item: any) => item.bvid === _videoInfo.bvid)
        videoData.pic = findItem.cover
        // videoData.pages = videoInfoData?.sectionEpisodes
      }
    }

    // 获取视频下载地址
    let acceptQuality = null
    try {
      let downLoadData: any = html.match(/\<script\>window\.\_\_playinfo\_\_\=([\s\S]*?)\<\/script\>\<script\>window\.\_\_INITIAL\_STATE\_\_\=/)
      if (!downLoadData) throw new Error(`parse bv error [downLoadData]: ${url}`)
      downLoadData = JSON.parse(downLoadData[1])
      acceptQuality = {
        accept_quality: downLoadData.data.accept_quality,
        video: downLoadData.data.dash.video,
        audio: handleAudio(downLoadData.data.dash)
      }
    } catch (error) {
      console.log('parseBV 获取视频地址失败，重新请求', error)
      acceptQuality = await getAcceptQuality(videoData.cid, videoData.bvid)
    }
    const obj: VideoData = {
      id: '',
      parseType: 'bv',
      title: videoData.title,
      url,
      bvid: videoData.bvid,
      cid: videoData.cid,
      cover: videoData.pic,
      createdTime: -1,
      quality: -1,
      view: videoData.stat.view,
      danmaku: videoData.stat.danmaku,
      reply: videoData.stat.reply,
      duration: formatSecond(videoData.duration),
      up: videoData.hasOwnProperty('staff') ? videoData.staff.map((item: any) => ({ name: item.name, mid: item.mid })) : [{ name: videoData.owner.name, mid: videoData.owner.mid }],
      qualityOptions: acceptQuality.accept_quality.map((item: keyof typeof qualityMap) => ({ label: qualityMap[item as keyof typeof qualityMap], value: item })),
      page: parseBVPageData(videoData, url),
      subtitle: [],
      video: acceptQuality.video ? acceptQuality.video.map((item: any) => ({ id: item.id, cid: videoData.cid, url: item.baseUrl })) : [],
      audio: acceptQuality.audio ? acceptQuality.audio.map((item: any) => ({ id: item.id, cid: videoData.cid, url: item.baseUrl })) : [],
      filePathList: [],
      fileDir: '',
      size: -1,
      downloadUrl: { video: '', audio: '' }
    }
    // console.log(obj)
    // console.log(videoData)
    return obj
  } catch (error: any) {
    throw new Error(error)
  }
}

const parseList = async (html: string, url: string) => {
  console.log('[render parseList]: ', url)
  try {
    const videoInfo = html.match(/<script>window\.__INITIAL_STATE__=([\s\S]*?);\(function\(\)/)
    if (!videoInfo) throw new Error(`parse bv error ${url}`)
    const { videoData, resourceList, playlist, mediaListInfo } = JSON.parse(videoInfo[1])
    console.log('parse List videoData', videoData)
    // 获取视频下载地址
    let acceptQuality = null
    try {
      let downLoadData: any = html.match(/\<script\>window\.\_\_playinfo\_\_\=([\s\S]*?)\<\/script\>\<script\>window\.\_\_INITIAL\_STATE\_\_\=/)
      if (!downLoadData) throw new Error(`parse bv error ${url}`)
      downLoadData = JSON.parse(downLoadData[1])
      acceptQuality = {
        accept_quality: downLoadData.data.accept_quality,
        video: downLoadData.data.dash.video,
        audio: handleAudio(downLoadData.data.dash)
      }
    } catch (error) {
      console.log('parseList 获取视频地址失败，重新请求', error)
      acceptQuality = await getAcceptQuality(videoData.cid, videoData.bvid)
      console.log('acceptQuality', acceptQuality)
    }

    // parseBVPageData()
    const obj: VideoData = {
      id: '',
      parseType: 'list',
      title: videoData.title,
      url,
      bvid: videoData.bvid,
      cid: videoData.cid,
      cover: videoData.pic,
      createdTime: -1,
      quality: -1,
      view: videoData.stat.view,
      danmaku: videoData.stat.danmaku,
      reply: videoData.stat.reply,
      duration: formatSecond(videoData.duration),
      up: videoData.hasOwnProperty('staff') ? videoData.staff.map((item: any) => ({ name: item.name, mid: item.mid })) : [{ name: videoData.owner.name, mid: videoData.owner.mid }],
      qualityOptions: acceptQuality.accept_quality.map((item: any) => ({ label: qualityMap[item as keyof typeof qualityMap], value: item })),
      // videoData page 如果存在 按 BVPageData解析
      page: videoData?.pages?.length > 2
        ? parseBVPageData(videoData, url)
        : parseListPageData(url, resourceList, playlist, mediaListInfo),
      subtitle: [],
      video: acceptQuality.video ? acceptQuality.video.map((item: any) => ({ id: item.id, cid: videoData.cid, url: item.baseUrl })) : [],
      audio: acceptQuality.audio ? acceptQuality.audio.map((item: any) => ({ id: item.id, cid: videoData.cid, url: item.baseUrl })) : [],
      filePathList: [],
      fileDir: '',
      size: -1,
      downloadUrl: { video: '', audio: '' }
    }
    console.log('parseList', obj)
    return obj
  } catch (error: any) {
    throw new Error(error)
  }
}

// function sleep (ms: number) {
//   return new Promise((resolve) => {
//     setTimeout(resolve, ms)
//   })
// }

const parseEP = async (html: string, url: string) => {
  console.log('[render parseEP]: ', url)
  try {
    // const videoInfo = html.match(/\<script\>window\.\_\_INITIAL\_STATE\_\_\=([\s\S]*?)\;\(function\(\)\{var s\;/)
    const nextDataMatch = html.match(/\<script id="__NEXT_DATA__" type="application\/json"\>([\s\S]*?)\<\/script\>/)
    if (!nextDataMatch) throw new Error('parse ep error __NEXT_DATA__')
    const nextData = JSON.parse(nextDataMatch[1])
    // console.log('nextData', nextData)
    // const playurlSSRData = html.match(/const playurlSSRData = ({[\s\S]*?})\n\s*if \(playurlSSRData.*?\) {/)
    const playurlSSRData = html.match(/const playurlSSRData = ({[\s\S]*?})\n\s*(if \(playurlSSRData.*?\) {|window\.__PLAYURL_HYDRATE_DATA__)/)
    // if (playurlSSRData && /window/.test(playurlSSRData?.[2])) {
    //   console.log(playurlSSRData?.[2])
    //   console.log('意外')
    // }
    if (!playurlSSRData) {
      // console.log(html)
      throw new Error('parse ep error playurlSSRData')
    }

    const __playinfo__ = JSON.parse(playurlSSRData[1])

    // https://api.bilibili.com/pgc/view/web/ep/list?season_id=2308

    // const { video_info, view_info, play_view_business_info } = __playinfo__.result || {}
    // const { ep_id } = view_info?.report || {}
    console.log('__playinfo__', __playinfo__)

    const videoInfo =
      __playinfo__?.result?.video_info ||
      __playinfo__?.raw?.data?.video_info ||
      __playinfo__?.data?.result?.video_info

    const viewInfo =
      __playinfo__?.result?.view_info ||
      __playinfo__?.body?.viewInfo ||
      __playinfo__?.data?.result?.view_info

    const playViewBusinessInfo =
      __playinfo__?.result?.play_view_business_info ||
      __playinfo__?.body?.playViewBusinessInfo ||
      __playinfo__?.data?.result?.play_view_business_info

    // console.log(videoInfo, viewInfo, playViewBusinessInfo)
    // const { h1Title, mediaInfo, epInfo, epList } = {} as any
    // const { epInfo, epList } = {} as any
    let mediaInfo
    if (Array.isArray(nextData?.props?.pageProps?.dehydratedState?.queries)) {
      const queries = nextData?.props?.pageProps?.dehydratedState?.queries
      if (queries.length === 1) {
        mediaInfo = queries?.[0]?.state?.data
      } else {
        mediaInfo = queries?.[1]?.state?.data
      }
    }
    // const mediaInfo = nextData?.props?.pageProps?.dehydratedState?.queries?.[1]?.state?.data
    let epInfo = playViewBusinessInfo?.episode_info || playViewBusinessInfo?.episodeInfo
    // console.log(epInfo)
    // bvid丢失
    if (!epInfo.bvid) {
      epInfo = Object.assign({}, epInfo, __playinfo__?.result?.arc || __playinfo__?.data?.result?.arc)
    }
    const ep_id = viewInfo?.report?.ep_id || epInfo?.ep_id
    console.log('epInfo', epInfo)
    const config = {
      headers: {
        'User-Agent': randUserAgent(),
        cookie: `SESSDATA=${store.settingStore(pinia).SESSDATA}`
      },
      responseType: 'json'
    }
    const { body: epListBody } = await window.electron.got(
      `https://api.bilibili.com/pgc/view/web/ep/list?ep_id=${ep_id}`,
      config
    )
    console.log('mediaInfo', mediaInfo)
    // console.log('epListBody?.result', epListBody?.result)
    let epList: any = []
    if (Array.isArray(epListBody?.result?.episodes)) {
      epList = epList.concat(epListBody?.result?.episodes)
    }
    // console.log('epListBody?.result?.section', epListBody?.result?.section)
    if (Array.isArray(epListBody?.result?.section)) {
      epListBody?.result?.section.forEach((item: any) => {
        if (Array.isArray(item?.episodes)) {
          // epList = epList.concat(item?.episodes)
          item?.episodes.forEach((epItem: any) => {
            // console.log('epItem', epItem, item.title)
            if (epItem.cid !== 0 && epItem.ep_id !== 0) {
              epList.push({
                ...epItem,
                sectionsTitle: item.title
              })
            }
          })
        }
      })
    }
    // const epList = res.body.result.episodes // ??
    const h1Title = mediaInfo.title
    // 获取视频下载地址
    let acceptQuality = null
    const downLoadData = videoInfo
    try {
      // let downLoadData: any = html.match(/\<script\>window\.\_\_playinfo\_\_\=([\s\S]*?)\<\/script\>\<script\>window\.\_\_INITIAL\_STATE\_\_\=/)
      // if (!downLoadData) throw new Error('parse ep error')
      // downLoadData = JSON.parse(downLoadData[1])

      acceptQuality = {
        accept_quality: downLoadData.accept_quality,
        video: downLoadData.dash.video,
        audio: handleAudio(downLoadData.dash)
      }
    } catch (error) {
      console.log('parseEP 获取视频地址失败，重新请求', error)
      acceptQuality = await getAcceptQuality(epInfo.cid, epInfo.bvid)
    }
    const obj: VideoData = {
      id: '',
      parseType: 'ep',
      title: h1Title,
      url,
      bvid: epInfo.bvid,
      cid: epInfo.cid,
      cover: mediaInfo.cover,
      createdTime: -1,
      quality: -1,
      view: mediaInfo.stat.views,
      danmaku: mediaInfo.stat.danmakus,
      reply: mediaInfo.stat.reply,
      // 非会员的账号读取会员视频时 读取不到dash
      duration: formatSecond(downLoadData?.dash?.duration / 1000),
      // duration: formatSecond(downLoadData.dash.duration / 1000),
      up: mediaInfo.upInfo ? [{ name: mediaInfo.upInfo.name, mid: mediaInfo.upInfo.mid }] : [{ name: '', mid: '' }],
      qualityOptions: acceptQuality.accept_quality.map((item: any) => ({ label: qualityMap[item as keyof typeof qualityMap], value: item })),
      page: parseEPPageData(epList, h1Title),
      subtitle: [],
      video: acceptQuality.video ? acceptQuality.video.map((item: any) => ({ id: item.id, cid: epInfo.cid, url: item.baseUrl })) : [],
      audio: acceptQuality.audio ? acceptQuality.audio.map((item: any) => ({ id: item.id, cid: epInfo.cid, url: item.baseUrl })) : [],
      filePathList: [],
      fileDir: '',
      size: -1,
      downloadUrl: { video: '', audio: '' }
    }
    console.log('ep')
    // console.log(obj)
    return obj
  } catch (error: any) {
    throw new Error(error)
  }
}

export const parseSS = async (html: string) => {
  try {
    const videoInfo = html.match(/\<script\>window\.\_\_INITIAL\_STATE\_\_\=([\s\S]*?)\;\(function\(\)\{var s\;/)
    if (!videoInfo) throw new Error('parse ss error')
    const { mediaInfo } = JSON.parse(videoInfo[1])
    const params = {
      url: `https://www.bilibili.com/bangumi/play/ep${mediaInfo.newestEp.id}`,
      config: {
        headers: {
          'User-Agent': randUserAgent(),
          cookie: `SESSDATA=${store.settingStore(pinia).SESSDATA}`
        }
      }
    }
    const { body } = await window.electron.got(params.url, params.config)
    return parseEP(body, params.url)
  } catch (error: any) {
    throw new Error(error)
  }
}

// 获取视频清晰度列表
const getAcceptQuality = async (cid: string, bvid: string) => {
  const SESSDATA = store.settingStore(pinia).SESSDATA
  const bfeId = store.settingStore(pinia).bfeId
  const config = {
    headers: {
      'User-Agent': randUserAgent(),
      cookie: `SESSDATA=${SESSDATA};bfe_id=${bfeId}`
    },
    responseType: 'json'
  }

  const params = {
    cid,
    bvid,
    qn: 127,
    type: '',
    otype: 'json',
    fourk: 1,
    fnver: 0,
    fnval: 80,
    session: '68191c1dc3c75042c6f35fba895d65b0'
  }
  let query = ''
  // 未登录需要wbi签名 未登录的情况下才可能调用 几乎没有 // TODO: 待定是否删除
  if (!SESSDATA) {
    const web_keys = await getWbiKeys('')
    const img_key = web_keys.img_key
    const sub_key = web_keys.sub_key
    query = encWbi(params, img_key, sub_key)
  } else {
    query = Object.entries(params).map(([key, value]) => `${key}=${value}`).join('&')
  }

  const res = await window.electron.got(
    `https://api.bilibili.com/x/player/wbi/playurl?${query}`,
    config
  )
  const { body, headers } = res
  const accept_quality = body?.data?.accept_quality || []
  const video = body.data?.dash?.video || []
  const audio = handleAudio(body.data?.dash) || []
  const responseCookies = headers['set-cookie']
  // 保存返回的cookies
  saveResponseCookies(responseCookies)
  return {
    accept_quality,
    video,
    audio
  }
}

// 获取指定清晰度视频下载地址
const getDownloadUrl = async (cid: number, bvid: string, quality: number) => {
  const SESSDATA = store.settingStore(pinia).SESSDATA
  const bfeId = store.settingStore(pinia).bfeId
  const config = {
    headers: {
      'User-Agent': randUserAgent(),
      // bfe_id必须要加
      cookie: SESSDATA ? `SESSDATA=${SESSDATA};bfe_id=${bfeId}` : ''
    },
    responseType: 'json'
  }

  const params = {
    cid,
    bvid,
    qn: quality,
    otype: 'json',
    fourk: 1,
    fnver: 0,
    fnval: 80
  }
  let query = ''
  // 未登录需要wbi签名 未登录的情况下才可能调用 几乎没有 // TODO: 待定是否删除
  if (!SESSDATA) {
    const web_keys = await getWbiKeys('')
    const img_key = web_keys.img_key
    const sub_key = web_keys.sub_key
    query = encWbi(params, img_key, sub_key)
  } else {
    query = Object.entries(params).map(([key, value]) => `${key}=${value}`).join('&')
  }
  const res = await window.electron.got(
    `https://api.bilibili.com/x/player/wbi/playurl?${query}`,
    config
  )
  // console.log('playurl', `https://api.bilibili.com/x/player/wbi/playurl?${query}`)
  // console.log('res', res)
  // 无视频可能是会员视频
  if (String(res.body.code) === '-404') {
    // throw new Error('无视频可能是会员视频')
    return {
      video: '',
      audio: '',
      quality
    }
  }
  const { body: { data }, headers: { 'set-cookie': responseCookies } } = res
  const { dash } = data
  // 保存返回的cookies
  saveResponseCookies(responseCookies)
  const tempVideo = dash.video.find((item: any) => item.id === quality)
  let tempQuality = quality
  // 自动降级视频清新度 取不到指定清晰度的视频，以返回数据的视频清晰度 第一项为准 如 4k视频 没有 dash.video[0]应该就是支持的最清晰的视频了
  let video = ''
  if (tempVideo) {
    video = tempVideo.baseUrl
  } else {
    video = dash.video[0].baseUrl
    tempQuality = dash.video[0].id
  }
  const audio = getHighQualityAudio(dash.audio).baseUrl
  // console.log('audio url', audio)
  return {
    video,
    audio,
    quality: tempQuality
  }
}

// 获取视频字幕
const getSubtitle = async (cid: number, bvid: string) => {
  const SESSDATA = store.settingStore(pinia).SESSDATA
  const bfeId = store.settingStore(pinia).bfeId
  const config = {
    headers: {
      'User-Agent': randUserAgent(),
      cookie: `SESSDATA=${SESSDATA};bfe_id=${bfeId}`
    },
    responseType: 'json'
  }
  // 获取视频字幕 偶尔会出现 412
  // Response code 412 (Precondition Failed)
  try {
    // console.log(cid, bvid, config)
    const queryParams: any = {
      cid,
      bvid
    }
    const query = Object.keys(queryParams).map(key => `${key}=${queryParams[key]}`).join('&')
    const apiUri = `https://api.bilibili.com/x/player/wbi/v2?${query}`
    // console.log('subtitle apiUri', apiUri)
    // await sleep(1000)
    const { body: { data: { subtitle } } } = await window.electron.got(apiUri, config)
    // console.log('subtitle', subtitle)
    const subtitleList: Subtitle[] = subtitle?.subtitles ? subtitle?.subtitles.map((item: any) => ({ title: item.lan_doc, url: item.subtitle_url })) : []
    return subtitleList
  } catch (e) {
    console.error('getSubtitle', e)
    return []
  }
}

// 处理filePathList
const handleFilePathList = (page: number, title: string, videoInfo: VideoData, bvid: string, id: string, saveFilePrefix = true): string[] => {
  const up = videoInfo.up[0].name
  const collectionName = (Array.isArray(videoInfo.page) && videoInfo.page.length > 1)
    ? videoInfo.page[0].collectionName
    : ''
  const storeDownloadPath = store.settingStore().downloadPath
  const formatFileNameVal = store.settingStore().formatFileNameVal
  const downloadPath = collectionName ? `${storeDownloadPath}/${collectionName}` : storeDownloadPath
  const name = `${(page && saveFilePrefix) ? `[P${page}]` : ''}${formatFileName(formatFileNameVal, { up, title, bvid, id })}`
  const isFolder = store.settingStore().isFolder
  let pathList = [
    `${downloadPath}/${name}.mp4`,
    `${downloadPath}/${name}.png`,
    `${downloadPath}/${name}-video.m4s`,
    `${downloadPath}/${name}-audio.m4s`,
    ''
  ]
  if (isFolder) {
    pathList = [
      `${downloadPath}/${name}/${name}.mp4`,
      `${downloadPath}/${name}/${name}.png`,
      `${downloadPath}/${name}/${name}-video.m4s`,
      `${downloadPath}/${name}/${name}-audio.m4s`,
      `${downloadPath}/${name}/`
    ]
  }
  return pathList
}

// 处理fileDir
const handleFileDir = (page: number, title: string, videoInfo: VideoData, bvid: string, id: string, saveFilePrefix = true): string => {
  const up = videoInfo.up[0].name
  const collectionName = (Array.isArray(videoInfo.page) && videoInfo.page.length > 1)
    ? videoInfo.page[0].collectionName
    : ''
  const storeDownloadPath = store.settingStore().downloadPath
  const formatFileNameVal = store.settingStore().formatFileNameVal
  const downloadPath = collectionName ? `${storeDownloadPath}/${collectionName}` : storeDownloadPath
  const name = `${(page && saveFilePrefix) ? `[P${page}]` : ''}${formatFileName(formatFileNameVal, { up, title, bvid, id })}`
  const isFolder = store.settingStore().isFolder
  return `${downloadPath}${isFolder ? `/${name}/` : ''}`
}
interface IParseBVPageData {
  bvid: string,
  title: string,
  pages: any[],
  ugc_season: {
    title: string,
    sections: [{
      episodes: any[],
      title: string
    }]
  }
}
// 处理bv多p逻辑
const parseBVPageData = ({ bvid, title, pages, ugc_season }: IParseBVPageData, url: string): Page[] => {
  const len = pages.length
  if (len === 1) {
    if (ugc_season && Array.isArray(ugc_season.sections) && ugc_season.sections.length > 0) {
      // TODO: 可能存在多个子合集 合并到一起
      const pages = ugc_season.sections.map(item => {
        return item.episodes.map(_item => ({
          sectionsTitle: item.title,
          ..._item
        }))
      }).flat()
      // const pages = ugc_season.sections[sectionsIndex].episodes
      return pages.map((item, index) => ({
        title: item.title,
        showTitle: item.title,
        sectionsTitle: item?.sectionsTitle || '',
        // 合集名
        collectionName: filterTitle(ugc_season.title) || '',
        page: index + 1,
        duration: formatSecond(item.arc.duration),
        cid: item.cid,
        bvid: item.bvid,
        url: `https://www.bilibili.com/video/${item.bvid}`
      }))
    }
    return [
      {
        title,
        showTitle: title,
        url,
        page: pages[0].page,
        duration: formatSecond(pages[0].duration),
        cid: pages[0].cid,
        bvid
      }
    ]
  } else {
    const { origin, pathname, searchParams } = new URL(url)
    const tempUrl = `${origin}${pathname}`
    return pages.map(item => {
      searchParams.set('p', item.page)
      return {
        title: item.part,
        showTitle: item.part,
        page: item.page,
        collectionName: filterTitle(title),
        duration: formatSecond(item.duration),
        cid: item.cid,
        bvid,
        url: `${tempUrl}?${searchParams.toString()}`
      }
    })
  }
}

// 处理ep多p逻辑
const parseEPPageData = (epList: any[], collectionName: string): Page[] => {
  // console.log(epList, collectionName)
  return epList.map((item, index) => {
    return {
      title: item.share_copy,
      showTitle: item?.title || item?.show_title || item?.long_title || item?.share_copy,
      longTitle: item?.share_copy,
      page: index + 1,
      duration: formatSecond(item.duration / 1000),
      cid: item.cid,
      bvid: item.bvid,
      url: item.share_url,
      collectionName,
      badge: item.badge || '',
      sectionsTitle: item.sectionsTitle || ''
    }
  })
}

// 处理 list 多p逻辑
const parseListPageData = (url: string, resourceList: any[], playlist: any, mediaListInfo: any): Page[] => {
  const { origin, pathname } = new URL(url)
  const listURL = `${origin}${pathname}`
  // console.log('url: string, resourceList: any[], playlist: any, mediaListInfo:', url, resourceList, playlist, mediaListInfo)
  const page = resourceList.map((item, index) => {
    // 20250409 原先id 对应cid bv_id 对应bvid 应该是接口变了
    const title = item.title || item?.pages?.[0]?.title
    const cid = item?.pages?.[0]?.cid || item?.pages?.[0]?.id
    const bvid = item.bvid || item.bv_id
    const duration = item?.pages?.[0]?.duration || item.duration
    return {
      title,
      showTitle: title,
      // page: item.page,
      page: index + 1,
      collectionName: filterTitle(mediaListInfo.title),
      duration: formatSecond(duration),
      cid,
      bvid,
      url: `${listURL}?sid=${playlist.id}&oid=${item.oid}&bvid=${bvid}`
    }
  })
  // console.log('page ---> ', page)
  return page
}

// 30216 64K
// 30232 132K
// 30280 192K
// 30250 杜比全景声
// 30251 Hi-Res无损
// 获取码率最高的audio
const getHighQualityAudio = (audioArray: any[]) => {
  // console.log(audioArray)
  // 优先 Hi-Res无损
  const hires = audioArray.find(item => item.id === 30251)
  if (hires) return hires
  // 优先 杜比全景声
  const DolbyAtmos = audioArray.find(item => item.id === 30251)
  if (DolbyAtmos) return DolbyAtmos
  return audioArray.sort((a, b) => b.id - a.id)[0]
}

// 统一处理audio 含盖 dolby 杜比全景声 和 flac  无损
function handleAudio (dash: any) {
  if (!Array.isArray(dash?.audio)) return []
  let audio = [...dash.audio]
  // dolby 杜比全景声
  if (Array.isArray(dash?.dolby?.audio)) {
    audio = audio.concat(dash.dolby?.audio)
  } else if (Boolean(dash?.dolby?.audio) && typeof dash?.dolby?.audio === 'object') {
    audio.push(dash.dolby?.audio)
  }
  // flac 无损
  if (Array.isArray(dash?.flac?.audio)) {
    audio = audio.concat(dash.flac?.audio)
  } else if (Boolean(dash?.flac?.audio) && typeof dash?.flac?.audio === 'object') {
    audio.push(dash.flac?.audio)
  }
  return audio
}

export {
  checkLogin,
  checkUrl,
  checkUrlRedirect,
  parseHtml,
  getDownloadList,
  addDownload
}
