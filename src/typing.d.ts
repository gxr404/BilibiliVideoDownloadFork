// import got from 'got'

type OnceChannel = 'init-store'
type OnChannel = 'download-video-status' | 'show-context-menu'
type ReplyMenuType = 'delete' | 'reload' | 'open' | 'selectAll' | 'play'

interface AnyObject {
  [key: string]: any
}

declare interface Window {
  log: import('electron-log').LogFunctions
  electron:{
    on: (channel: string, id: string, listener: (...args: any[]) => void) => void
    off: (channel: string, id: string) => void
    once: (channel: OnceChannel, listener: (...args: any[]) => void) => void
    send: (channel: string, ...args: any[]) => void
    // 最小化app
    minimizeApp: () => void
    // 关闭app
    closeApp: () => void
    // 获取视频大小(已弃用)
    getVideoSize: (id: string) => Promise<number>
    // 下载单个视频
    downloadVideo: (task: TaskData) => void
    // 下载视频列表
    downloadVideoList: (taskList: TaskData[]) => void
    // 打开链接
    openBrowser: (url: string) => void
    // 打开本地文件(用来播放视频)
    openPath: (path: string) => void
    // 下载列表-> 右击->打开文件夹
    openDir: (list: string[]) => void
    // 设置-> 下载地址 -> 打开文件夹弹窗
    openDirDialog: () => Promise<string>
    // 检测下载路径是否存在
    checkDownaldPathExist: () => boolean
    // 保存弹幕文件(已弃用~弹幕下载改用 background线程中下载自然也无需调用保存文件)
    saveDanmukuFile: (content: string, path: string) => void
    // 设置 electron-store !!谨慎使用 频繁多次调用会卡顿
    setStore: <T = any>(path: string, data: T) => void
    // 设置 任务列表electron-store
    setTaskListStore: (taskList: TaskData[]) => void
    // 删除electron-store中指定路径
    deleteStore: (path: string) => void
    // 删除任务列表electron-store
    deleteTaskListStore: (idList: string[]) => void
    // 显示右击菜单
    showContextmenu: (type: MenuType) => Promise<ReplyMenuType>
    // 打开重新视频下载弹窗
    openReloadVideoDialog: (taskCount: number) => Promise<Electron.MessageBoxReturnValue>
    // got: typeof got
    [key: string]: any
  }
  log: any
}
