import { contextBridge, ipcRenderer } from 'electron'
const log = require('electron-log')

contextBridge.exposeInMainWorld('log', log.functions)

const listenerMap = new Map()
contextBridge.exposeInMainWorld('electron', {
  openBrowser (url) {
    // log.functions.log('[bridge-openBrowser]:', url)
    ipcRenderer.send('open-browser', url)
  },
  openPath (path) {
    // log.functions.log('[bridge-openPath]:', path)
    ipcRenderer.send('open-path', path)
  },
  openDirDialog () {
    // log.functions.log('[bridge-openDirDialog]:')
    return ipcRenderer.invoke('open-dir-dialog')
  },
  got (url, option) {
    // log.functions.log('[bridge-got]:', url, option)
    return ipcRenderer.invoke('got', url, option)
  },
  gotBuffer (url, option) {
    // log.functions.log('[bridge-gotBuffer]:', url, option)
    return ipcRenderer.invoke('got-buffer', url, option)
  },
  getStore (path) {
    // log.functions.log('[bridge-getStore]:', path)
    return ipcRenderer.invoke('get-store', path)
  },
  setStore (path, data) {
    // log.functions.log('[bridge-setStore]:', path, data)
    ipcRenderer.send('set-store', path, data)
  },
  setTaskListStore (list) {
    // log.functions.log('[bridge-setTaskListStore]:', list)
    ipcRenderer.send('set-task-list-store', list)
  },
  deleteStore (path) {
    // log.functions.log('[bridge-deleteStore]:', path)
    ipcRenderer.send('delete-store', path)
  },
  deleteTaskListStore (idList) {
    // log.functions.log('[bridge-deleteTaskListStore]:', idList)
    ipcRenderer.send('delete-task-list-store', idList)
  },
  showContextmenu (type) {
    // log.functions.log('[bridge-showContextmenu]:', type)
    ipcRenderer.send('show-context-menu', type)
  },
  openDir (list) {
    // log.functions.log('[bridge-openDir]:', list)
    ipcRenderer.send('open-dir', list)
  },
  openDeleteVideoDialog (count) {
    // log.functions.log('[bridge-openDeleteVideoDialog]:', count)
    return ipcRenderer.invoke('open-delete-video-dialog', count)
  },
  deleteVideos (list) {
    // log.functions.log('[bridge-deleteVideos]:', list)
    return ipcRenderer.invoke('delete-videos', list)
  },
  downloadVideo (task) {
    // log.functions.log('[bridge-downloadVideo]:', task)
    ipcRenderer.send('download-video', task)
  },
  downloadVideoList (taskList) {
    // log.functions.log('[bridge-downloadVideoList]:', taskList)
    ipcRenderer.send('download-video-list', taskList)
  },
  getVideoSize (id) {
    // log.functions.log('[bridge-getVideoSize]:', id)
    return ipcRenderer.invoke('get-video-size', id)
  },
  checkDownaldPathExist () {
    // log.functions.log('[bridge-checkDownaldPathExist]:')
    return ipcRenderer.invoke('check-download-path-exist')
  },
  closeApp () {
    // log.functions.log('[bridge-closeApp]:')
    ipcRenderer.send('close-app')
  },
  minimizeApp () {
    // log.functions.log('[bridge-minimizeApp]:')
    ipcRenderer.send('minimize-app')
  },
  openReloadVideoDialog (count) {
    // log.functions.log('[bridge-openReloadVideoDialog]:', count)
    return ipcRenderer.invoke('open-reload-video-dialog', count)
  },
  saveDanmukuFile (content, path) {
    // log.functions.log('[bridge-saveDanmukuFile]:', /** content, **/ path)
    ipcRenderer.send('save-danmuku-file', content, path)
  },
  on (channel, nanoid, func) {
    // log.functions.log('[bridge-on]:', channel, nanoid, func)
    const validChannels = [
      'download-video-status',
      // 'download-danmuku',
      'show-context-menu-reply'
    ]
    if (validChannels.includes(channel)) {
      const subscription = (_event, ...args) => func(...args)
      if (typeof func === 'function') {
        const key = `${channel}_${nanoid}`
        listenerMap.set(key, subscription)
        ipcRenderer.on(channel, subscription)
      }
      // return () => ipcRenderer.removeListener(channel, subscription)
    }
    // return undefined
  },
  once (channel, func) {
    // log.functions.log('[bridge-once]:', channel, func)
    const validChannels = ['init-store']
    if (validChannels.includes(channel)) {
      // Deliberately strip event as it includes `sender`
      ipcRenderer.once(channel, (_event, ...args) => func(...args))
    }
  },
  off (channel, nanoid) {
    // log.functions.log('[bridge-off]:', channel, nanoid)
    const key = `${channel}_${nanoid}`
    const fn = listenerMap.get(key)
    if (fn) {
      listenerMap.delete(key)
      ipcRenderer.off(channel, fn)
    }
    // ipcRenderer.removeAllListeners(channel)
  }
})
