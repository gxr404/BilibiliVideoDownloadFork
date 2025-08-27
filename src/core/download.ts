import fs from 'fs-extra'
import { IpcMainEvent } from 'electron'
import { mergeVideoAudio } from './media'
import { randUserAgent } from '../utils'
import { downloadSubtitle } from './subtitle'
import { TaskData, SettingData } from '../type'
import { downloadDanmaku } from './danmaku'
import store from './mainStore'
import { throttle } from 'lodash'
import { STATUS } from '../assets/data/status'

const log = require('electron-log')
const stream = require('stream')
const { promisify } = require('util')
const got = require('got')
const pipeline = promisify(stream.pipeline)

function handleDeleteFile (setting: SettingData, videoInfo: TaskData) {
  // 删除原视频
  if (setting.isDelete) {
    const filePathList = videoInfo.filePathList
    fs.removeSync(filePathList[2])
    fs.removeSync(filePathList[3])
  }
}

async function getVideoSize (pathList: string[]) {
  const [mp4Path, , videoPath, audioPath] = pathList
  try {
    return fs.stat(mp4Path).then(stat => stat.size)
  } catch (error: any) {
    log.error(`[main-get-video-size]: error ${error?.message || 'unknown error'}`)
  }
  // 如获取mp4失败则可能 是设置了不合并视频，则视频大小 = video + audio
  try {
    const plist = [fs.stat(videoPath), fs.stat(audioPath)]
    return Promise.all(plist).then(([videoStat, audioStat]) => videoStat.size + audioStat.size)
  } catch (error) {
    return 0
  }
}

function updateStore (id: string, data: AnyObject) {
  const preTaskData = store.get(`taskList.${id}`)
  // 如果状态不变 那就只可能进度变化，不是很重要的信息 则不更新 electron的store(不是渲染层的store)
  if (preTaskData?.status === data.status) return
  // 失败的状态不再更改
  if (preTaskData?.status === STATUS.FAIL) return
  // console.log('>>>>> ', preTaskData.status, preTaskData?.progress, data.status, data.progress) // 5 0 1 0
  // const isReDownload = preTaskData.status === STATUS.FAIL && data.status === STATUS.VIDEO_DOWNLOADING
  // console.log('isReDownload >>>', isReDownload, preTaskData.status, preTaskData?.progress, data.status, data.progress)
  // 如果出现进度倒退的情况 则抛弃此次 download-video-status, 失败的情况特殊 因为无 progress
  if (
    data.status !== STATUS.FAIL &&
    preTaskData && preTaskData?.progress &&
    preTaskData?.progress > data.progress
    // && !isReDownload
  ) {
    return
  }
  // console.log('[main-update-store]: ', id, data, preTaskData)
  store.set(`taskList.${id}`, Object.assign({}, preTaskData, data))
}

export default async (videoInfo: TaskData, event: IpcMainEvent, setting: SettingData) => {
  // log.info(videoInfo.id, videoInfo.title)
  // const takeInfo = store.get(`taskList.${videoInfo.id}`)
  // log.info('mainStore', takeInfo, takeInfo && takeInfo.status)
  // if (takeInfo && takeInfo.status === STATUS.FAIL) {
  //   log.error('×××××!!!!!已经失败过的内容')
  // }
  // if (takeInfo && takeInfo.status === STATUS.COMPLETED) {
  //   log.error('×××××已经下载过的内容')
  // }
  // if (videoInfo.status === STATUS.FAIL) {
  //   log.error('已经失败的,又再次下载', videoInfo.title)
  // }

  const updateData = {
    id: videoInfo.id,
    status: STATUS.VIDEO_DOWNLOADING,
    progress: Math.round(0)
  }
  event.reply('download-video-status', updateData)
  updateStore(videoInfo.id, {
    ...videoInfo,
    ...updateData
  })

  // 去掉扩展名的文件路径
  const fileName = videoInfo.filePathList[0].substring(0, videoInfo.filePathList[0].length - 4)
  // if (setting.isFolder) {
  // 创建文件夹 存在多p视频时 设置关闭了 下载到单独的文件时 也会需插件合集的目录
  try {
    if (!fs.existsSync(videoInfo.fileDir)) {
      fs.mkdirSync(`${videoInfo.fileDir}`, {
        recursive: true
      })
      log.info(`文件夹创建成功：${videoInfo.fileDir}`)
    } else {
      log.info(`文件夹已存在：${videoInfo.fileDir}`)
    }
  } catch (error) {
    log.error(`创建文件夹失败：${error}`)
  }
  // }
  // >>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 下载封面 <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
  if (setting.isCover) {
    const imageConfig = {
      headers: {
        'User-Agent': randUserAgent(),
        cookie: `SESSDATA=${setting.SESSDATA}`
      }
    }
    await pipeline(
      got.stream(videoInfo.cover, imageConfig)
        .on('error', (error: any) => {
          console.log(error)
        }),
      fs.createWriteStream(videoInfo.filePathList[1])
    )
    log.info(`✅ 下载封面完成 ${videoInfo.title}`)
  }

  log.info(`下载字幕 "${JSON.stringify(videoInfo.subtitle)}"`)
  // 下载字幕 (属于额外的文件无需merge)无需await
  if (setting.isSubtitle &&
    Array.isArray(videoInfo.subtitle) &&
    videoInfo.subtitle.length > 0) {
    downloadSubtitle(fileName, videoInfo.subtitle)
    log.info(`✅ 下载字幕完成 ${videoInfo.title}`)
  }

  // >>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 下载弹幕 (属于额外的文件无需merge)无需await <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
  if (setting.isDanmaku) {
    // event.reply('download-danmuku', videoInfo.cid, videoInfo.title, `${fileName}.ass`)

    downloadDanmaku(videoInfo.cid, videoInfo.title, `${fileName}.ass`)
    log.info(`✅ 下载弹幕完成 ${videoInfo.title}`)
  }

  const downloadConfig = {
    headers: {
      'User-Agent': randUserAgent(),
      referer: videoInfo.url
    },
    cookie: `SESSDATA=${setting.SESSDATA}`
  }
  function videoProgressNotify (progress: any) {
    const updateData = {
      id: videoInfo.id,
      status: STATUS.VIDEO_DOWNLOADING,
      progress: Math.round(progress.percent * 100 * 0.74)
    }
    // console.log('id', videoInfo.id, Math.round(progress.percent * 100 * 0.75))
    event.reply('download-video-status', updateData)

    // store.set(`taskList.${videoInfo.id}`, Object.assign(videoInfo, updateData))
    updateStore(videoInfo.id, Object.assign(videoInfo, updateData))
    //   {
    //   ...videoInfo,
    //   ...updateData
    // })
  }
  // >>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 下载视频 <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
  await pipeline(
    got.stream(videoInfo.downloadUrl.video, downloadConfig)
      .on('downloadProgress', throttle(videoProgressNotify, 4000))
      .on('error', async (error: any) => {
        log.error(`视频下载失败：${videoInfo.title}--${error.message}`)
        log.error(`------${videoInfo.downloadUrl.video}, ${JSON.stringify(downloadConfig)}`)
        const updateData = {
          id: videoInfo.id,
          status: STATUS.FAIL
        }
        // store.set(`taskList.${videoInfo.id}`, {
        //   ...videoInfo,
        //   ...updateData
        // })
        // store.set(`taskList.${videoInfo.id}`, Object.assign(videoInfo, updateData))
        // 防止最后一次节流把错误状态给覆盖掉
        // await sleep(500)
        event.reply('download-video-status', updateData)
        updateStore(videoInfo.id, Object.assign(videoInfo, updateData))
      }),
    fs.createWriteStream(videoInfo.filePathList[2])
  )

  log.info(`✅ 下载视频完成 ${videoInfo.title}`)

  // await sleep(2500)

  function audioProgressNotify (progress: any) {
    const updateData = {
      id: videoInfo.id,
      status: STATUS.AUDIO_DOWNLOADING,
      progress: Math.round((progress.percent * 100 * 0.22) + 75)
    }
    event.reply('download-video-status', updateData)
    updateStore(videoInfo.id, Object.assign(videoInfo, updateData))
    // store.set(`taskList.${videoInfo.id}`, Object.assign(videoInfo, updateData))
    // store.set(`taskList.${videoInfo.id}`, {
    //   ...videoInfo,
    //   ...updateData
    // })
  }

  // >>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 下载音频 <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
  await pipeline(
    got.stream(videoInfo.downloadUrl.audio, downloadConfig)
      .on('downloadProgress', throttle(audioProgressNotify, 4000))
      .on('error', async (error: any) => {
        log.error(`音频下载失败：${videoInfo.title} ${error.message}`)
        const updateData = {
          id: videoInfo.id,
          status: STATUS.FAIL
        }
        // store.set(`taskList.${videoInfo.id}`, Object.assign(videoInfo, updateData))
        // store.set(`taskList.${videoInfo.id}`, {
        //   ...videoInfo,
        //   ...updateData
        // })
        // // 防止最后一次节流把错误状态给覆盖掉
        // await sleep(500)
        event.reply('download-video-status', updateData)
        updateStore(videoInfo.id, Object.assign(videoInfo, updateData))
      }),
    fs.createWriteStream(videoInfo.filePathList[3])
  )
  log.info(`✅ 下载音频完成 ${videoInfo.title}`)

  // await sleep(2500)

  // >>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 合成视频 <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
  if (setting.isMerge) {
    const updateData = {
      id: videoInfo.id,
      status: STATUS.MERGING,
      progress: 98
    }
    event.reply('download-video-status', updateData)
    // store.set(`taskList.${videoInfo.id}`, {
    //   ...videoInfo,
    //   ...updateData
    // })
    updateStore(videoInfo.id, {
      ...videoInfo,
      ...updateData
    })
    try {
      const res = await mergeVideoAudio(
        videoInfo.filePathList[2],
        videoInfo.filePathList[3],
        videoInfo.filePathList[0]
      )
      log.info(`✅ 音视频合成成功：${videoInfo.title} ${res}`)
      const updateData = {
        id: videoInfo.id,
        status: STATUS.COMPLETED,
        progress: 100,
        size: -1
      }
      if (Array.isArray(videoInfo.filePathList)) {
        const videoSize = await getVideoSize(videoInfo.filePathList)
        updateData.size = videoSize
      }
      event.reply('download-video-status', updateData)
      // store.set(`taskList.${videoInfo.id}`, {
      //   ...videoInfo,
      //   ...updateData
      // })
      updateStore(videoInfo.id, {
        ...videoInfo,
        ...updateData
      })
    } catch (error: any) {
      log.error(`音视频合成失败：${videoInfo.title} ${error.message}`)
      const updateData = {
        id: videoInfo.id,
        status: STATUS.FAIL
      }
      event.reply('download-video-status', updateData)
      // store.set(`taskList.${videoInfo.id}`, {
      //   ...videoInfo,
      //   ...updateData
      // })
      updateStore(videoInfo.id, {
        ...videoInfo,
        ...updateData
      })
    } finally {
      // 删除原视频
      handleDeleteFile(setting, videoInfo)
    }
  } else {
    const updateData = {
      id: videoInfo.id,
      status: STATUS.COMPLETED,
      progress: 100
    }
    event.reply('download-video-status', updateData)
    // store.set(`taskList.${videoInfo.id}`, {
    //   ...videoInfo,
    //   ...updateData
    // })
    updateStore(videoInfo.id, {
      ...videoInfo,
      ...updateData
    })
    handleDeleteFile(setting, videoInfo)
  }
}
