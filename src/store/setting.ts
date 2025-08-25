import { defineStore } from 'pinia'
import { isUndefined } from 'lodash'
import { set, SettingData, SettingDataEasy, SettingDataEasyKey } from '../type/index'

export const settingStore = defineStore('setting', {
  state: () => {
    const setting: SettingData = {
      downloadPath: '',
      defaultDownladPath: '',
      SESSDATA: '',
      isMerge: true,
      isDelete: true,
      bfeId: '',
      isSubtitle: true,
      isDanmaku: true,
      isFolder: true,
      isCover: true,
      downloadingMaxSize: 5,
      formatFileNameVal: 0,
      face: ''
    }
    return setting
  },
  getters: {
    getSetting: (state) => ({
      downloadPath: state.downloadPath,
      defaultDownladPath: state.defaultDownladPath,
      SESSDATA: state.SESSDATA,
      isMerge: state.isMerge,
      isDelete: state.isDelete,
      bfeId: state.bfeId,
      isSubtitle: state.isSubtitle,
      isDanmaku: state.isDanmaku,
      isFolder: state.isFolder,
      isCover: state.isCover,
      downloadingMaxSize: state.downloadingMaxSize,
      formatFileNameVal: state.formatFileNameVal
    })
  },
  actions: {
    setDownloadPath (path: string) {
      this.downloadPath = path
      window.electron.setStore('setting.downloadPath', path)
    },
    setSESSDATA (SESSDATA: string) {
      this.SESSDATA = SESSDATA
      window.electron.setStore('setting.SESSDATA', SESSDATA)
    },
    setIsMerge (data: boolean) {
      this.isMerge = data
      window.electron.setStore('setting.isMerge', data)
    },
    setIsDelete (data: boolean) {
      this.isDelete = data
      window.electron.setStore('setting.isDelete', data)
    },
    setBfeId (bfeId: string) {
      this.bfeId = bfeId
      window.electron.setStore('setting.bfeId', bfeId)
    },
    setIsSubtitle (data: boolean) {
      this.isSubtitle = data
      window.electron.setStore('setting.isSubtitle', data)
    },
    setIsDanmaku (data: boolean) {
      this.isDanmaku = data
      window.electron.setStore('setting.isDanmaku', data)
    },
    setIsFolder (data: boolean) {
      this.isFolder = data
      window.electron.setStore('setting.isFolder', data)
    },
    setIsCover (data: boolean) {
      this.isCover = data
      window.electron.setStore('setting.isCover', data)
    },
    setDownloadingMaxSize (size: number) {
      this.downloadingMaxSize = size
      window.electron.setStore('setting.downloadingMaxSize', size)
    },
    setFace (url: string) {
      this.face = url || ''
      window.electron.setStore('setting.face', url)
    },
    setFormatFileNameVal (value: number) {
      this.formatFileNameVal = value || 0
      window.electron.setStore('setting.formatFileNameVal', value)
    },
    setSetting (setting: SettingDataEasy) {
      const allSetting = this.getSetting
      for (const _key in allSetting) {
        const key = _key as SettingDataEasyKey
        const value = setting[key]
        if (!isUndefined(value)) {
          set(allSetting, key, value)
          set(this, key, value)
        }
      }
      window.electron.setStore('setting', allSetting)
    }
  }
})
