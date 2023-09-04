import { formatSeconed, filterTitle, randUserAgent } from '../utils'
import { qualityMap } from '../assets/data/quality'
import { customAlphabet } from 'nanoid'
import alphabet from '../assets/data/alphabet'
import { VideoData, Page, DownloadUrl, Subtitle, TaskData, Audio } from '../type'
import { store, pinia } from '../store'
import { STATUS } from '../assets/data/status'

// 自定义uuid
const nanoid = customAlphabet(alphabet, 16)

/**
 * @params videoInfo: 当前下载的视频详情 selected：所选的分p quality：所选的清晰度
 * @returns 返回下载数据 Array
 */
const getDownloadList = async (videoInfo: VideoData, selected: number[], quality: number, isReload = false, oldTask?: VideoData) => {
  const downloadList: VideoData[] = []
  for (let index = 0; index < selected.length; index++) {
    const currentPage = selected[index]
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
    if (videoUrl && audioUrl) {
      downloadUrl.video = videoUrl.url
      downloadUrl.audio = audioUrl.url
    } else {
      const { video, audio } = await getDownloadUrl(currentCid, currentBvid, quality)
      downloadUrl.video = video
      downloadUrl.audio = audio
    }
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
      quality: quality,
      duration: currentPageData.duration,
      createdTime: +new Date(),
      cid: currentCid,
      bvid: currentBvid,
      downloadUrl,
      filePathList: handleFilePathList(selected.length === 1 && !isReload ? 0 : currentPage, currentPageData.title, tempVideoInfo, currentBvid, taskId),
      fileDir: handleFileDir(selected.length === 1 && !isReload ? 0 : currentPage, currentPageData.title, tempVideoInfo, currentBvid, taskId),
      subtitle
    }
    downloadList.push(videoData)
    // if (index !== selected.length - 1) {
    //   await sleep(1000)
    // }
  }
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
  if (body.data.isLogin && !body.data.vipStatus) {
    return 1
  } else if (body.data.isLogin && body.data.vipStatus) {
    return 2
  } else {
    return 0
  }
}

// 检查url合法
const checkUrl = (url: string) => {
  const mapUrl = {
    'video/av': 'BV',
    'video/BV': 'BV',
    'play/ss': 'ss',
    'play/ep': 'ep'
  }
  let flag = false
  for (const key in mapUrl) {
    if (url.includes(key)) {
      flag = true
      return mapUrl[key]
    }
  }
  if (!flag) {
    return ''
  }
}

// 检查url是否有重定向
const checkUrlRedirect = async (videoUrl: string) => {
  const params = {
    videoUrl,
    config: {
      headers: {
        'User-Agent': randUserAgent(),
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
      return parseSS(html)
    case 'ep':
      return parseEP(html, url)
    default:
      return -1
  }
}

const parseBV = async (html: string, url: string) => {
  try {
    const videoInfo = html.match(/\<\/script\>\<script\>window\.\_\_INITIAL\_STATE\_\_\=([\s\S]*?)\;\(function\(\)/)
    if (!videoInfo) throw new Error(`parse bv error ${url}`)
    const { videoData } = JSON.parse(videoInfo[1])
    // 获取视频下载地址
    let acceptQuality = null
    try {
      let downLoadData: any = html.match(/\<script\>window\.\_\_playinfo\_\_\=([\s\S]*?)\<\/script\>\<script\>window\.\_\_INITIAL\_STATE\_\_\=/)
      if (!downLoadData) throw new Error(`parse bv error ${url}`)
      downLoadData = JSON.parse(downLoadData[1])
      acceptQuality = {
        accept_quality: downLoadData.data.accept_quality,
        video: downLoadData.data.dash.video,
        audio: downLoadData.data.dash.audio
      }
    } catch (error) {
      acceptQuality = await getAcceptQuality(videoData.cid, videoData.bvid)
    }
    const obj: VideoData = {
      id: '',
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
      duration: formatSeconed(videoData.duration),
      up: videoData.hasOwnProperty('staff') ? videoData.staff.map((item: any) => ({ name: item.name, mid: item.mid })) : [{ name: videoData.owner.name, mid: videoData.owner.mid }],
      qualityOptions: acceptQuality.accept_quality.map((item: any) => ({ label: qualityMap[item], value: item })),
      page: parseBVPageData(videoData, url),
      subtitle: [],
      video: acceptQuality.video ? acceptQuality.video.map((item: any) => ({ id: item.id, cid: videoData.cid, url: item.baseUrl })) : [],
      audio: acceptQuality.audio ? acceptQuality.audio.map((item: any) => ({ id: item.id, cid: videoData.cid, url: item.baseUrl })) : [],
      filePathList: [],
      fileDir: '',
      size: -1,
      downloadUrl: { video: '', audio: '' }
    }
    console.log('bv')
    console.log(obj)
    return obj
  } catch (error: any) {
    throw new Error(error)
  }
}

const parseEP = async (html: string, url: string) => {
  try {
    const videoInfo = html.match(/\<script\>window\.\_\_INITIAL\_STATE\_\_\=([\s\S]*?)\;\(function\(\)\{var s\;/)
    // const videoInfo = html.match(/\<script id="__NEXT_DATA__" type="application\/json"\>([\s\S]*?)\<\/script\>/)
    if (!videoInfo) throw new Error('parse ep error')
    const { h1Title, mediaInfo, epInfo, epList } = JSON.parse(videoInfo[1])
    // 获取视频下载地址
    let acceptQuality = null
    try {
      let downLoadData: any = html.match(/\<script\>window\.\_\_playinfo\_\_\=([\s\S]*?)\<\/script\>\<script\>window\.\_\_INITIAL\_STATE\_\_\=/)
      if (!downLoadData) throw new Error('parse ep error')
      downLoadData = JSON.parse(downLoadData[1])
      acceptQuality = {
        accept_quality: downLoadData.data.accept_quality,
        video: downLoadData.data.dash.video,
        audio: downLoadData.data.dash.audio
      }
    } catch (error) {
      acceptQuality = await getAcceptQuality(epInfo.cid, epInfo.bvid)
    }
    const obj: VideoData = {
      id: '',
      title: h1Title,
      url,
      bvid: epInfo.bvid,
      cid: epInfo.cid,
      cover: `http:${mediaInfo.cover}`,
      createdTime: -1,
      quality: -1,
      view: mediaInfo.stat.views,
      danmaku: mediaInfo.stat.danmakus,
      reply: mediaInfo.stat.reply,
      duration: formatSeconed(epInfo.duration / 1000),
      up: [{ name: mediaInfo.upInfo.name, mid: mediaInfo.upInfo.mid }],
      qualityOptions: acceptQuality.accept_quality.map((item: any) => ({ label: qualityMap[item], value: item })),
      page: parseEPPageData(epList),
      subtitle: [],
      video: acceptQuality.video ? acceptQuality.video.map((item: any) => ({ id: item.id, cid: epInfo.cid, url: item.baseUrl })) : [],
      audio: acceptQuality.audio ? acceptQuality.audio.map((item: any) => ({ id: item.id, cid: epInfo.cid, url: item.baseUrl })) : [],
      filePathList: [],
      fileDir: '',
      size: -1,
      downloadUrl: { video: '', audio: '' }
    }
    console.log('ep')
    console.log(obj)
    return obj
  } catch (error: any) {
    throw new Error(error)
  }
}

const parseSS = async (html: string) => {
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
  const { body: { data: { accept_quality, dash: { video, audio } } }, headers: { 'set-cookie': responseCookies } } = await window.electron.got(
    `https://api.bilibili.com/x/player/playurl?cid=${cid}&bvid=${bvid}&qn=127&type=&otype=json&fourk=1&fnver=0&fnval=80&session=68191c1dc3c75042c6f35fba895d65b0`,
    config
  )
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
      cookie: `SESSDATA=${SESSDATA};bfe_id=${bfeId}`
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
  const query = Object.keys(params).map(key => `${key}=${params[key]}`).join('&')
  const { body: { data }, headers: { 'set-cookie': responseCookies } } = await window.electron.got(
    `https://api.bilibili.com/x/player/playurl?${query}`,
    config
  )
  const { dash } = data
  // 保存返回的cookies
  saveResponseCookies(responseCookies)
  const tempVideo = dash.video.find((item: any) => item.id === quality)
  const video = tempVideo ? tempVideo.baseUrl : dash.video[0].baseUrl
  const audio = getHighQualityAudio(dash.audio).baseUrl
  return {
    video,
    audio
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
  const { body: { data: { subtitle } } } = await window.electron.got(`https://api.bilibili.com/x/player/v2?cid=${cid}&bvid=${bvid}`, config)
  const subtitleList: Subtitle[] = subtitle.subtitles ? subtitle.subtitles.map((item: any) => ({ title: item.lan_doc, url: item.subtitle_url })) : []
  return subtitleList
}

// 处理filePathList
const handleFilePathList = (page: number, title: string, videoInfo: VideoData, bvid: string, id: string): string[] => {
  const up = videoInfo.up[0].name
  const collectionName = (Array.isArray(videoInfo.page) && videoInfo.page.length > 1)
    ? videoInfo.page[0].collectionName
    : ''
  const storeDownloadPath = store.settingStore().downloadPath
  const downloadPath = collectionName ? `${storeDownloadPath}/${collectionName}-${up}` : storeDownloadPath
  const name = `${!page ? '' : `[P${page}]`}${filterTitle(`${title}-${up}-${bvid}-${id}`)}`
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
const handleFileDir = (page: number, title: string, videoInfo: VideoData, bvid: string, id: string): string => {
  const up = videoInfo.up[0].name
  const collectionName = (Array.isArray(videoInfo.page) && videoInfo.page.length > 1)
    ? videoInfo.page[0].collectionName
    : ''
  const storeDownloadPath = store.settingStore().downloadPath
  const downloadPath = collectionName ? `${storeDownloadPath}/${collectionName}-${up}` : storeDownloadPath

  const name = `${!page ? '' : `[P${page}]`}${filterTitle(`${title}-${up}-${bvid}-${id}`)}`
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
      episodes: any[]
    }]
  }
}
// 处理bv多p逻辑
const parseBVPageData = ({ bvid, title, pages, ugc_season }: IParseBVPageData, url: string): Page[] => {
  const len = pages.length
  if (len === 1) {
    if (ugc_season && Array.isArray(ugc_season.sections) && ugc_season.sections.length > 0) {
      // TODO: 可能存在多个子合集 合并到一起
      const pages = ugc_season.sections.map(item => item.episodes).flat()
      // const pages = ugc_season.sections[sectionsIndex].episodes
      return pages.map((item, index) => ({
        title: item.title,
        // 合集名
        collectionName: ugc_season.title || '',
        page: index + 1,
        duration: formatSeconed(item.arc.duration),
        cid: item.cid,
        bvid: item.bvid,
        url: `https://www.bilibili.com/video/${item.bvid}`
      }))
    }
    return [
      {
        title,
        url,
        page: pages[0].page,
        duration: formatSeconed(pages[0].duration),
        cid: pages[0].cid,
        bvid: bvid
      }
    ]
  } else {
    return pages.map(item => ({
      title: item.part,
      page: item.page,
      collectionName: title,
      duration: formatSeconed(item.duration),
      cid: item.cid,
      bvid: bvid,
      url: `${url}?p=${item.page}`
    }))
  }
}

// 处理ep多p逻辑
const parseEPPageData = (epList: any[]): Page[] => {
  return epList.map((item, index) => ({
    title: item.share_copy,
    page: index + 1,
    duration: formatSeconed(item.duration / 1000),
    cid: item.cid,
    bvid: item.bvid,
    url: item.share_url
  }))
}

// 获取码率最高的audio
const getHighQualityAudio = (audioArray: any[]) => {
  return audioArray.sort((a, b) => b.id - a.id)[0]
}

export {
  checkLogin,
  checkUrl,
  checkUrlRedirect,
  parseHtml,
  getDownloadList,
  addDownload
}
