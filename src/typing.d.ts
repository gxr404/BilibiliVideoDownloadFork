// import got from 'got'

type OnceChannel = 'init-store'
type OnChannel = 'download-video-status' | 'download-danmuku' | 'show-context-menu'
type ReplyMenuType = 'delete' | 'reload' | 'open' | 'selectAll' | 'play'

interface AnyObject {
  [key: string]: any
}

declare interface Window {
  electron:{
    on: (channel: string, listener: (...args: any[]) => void) => void
    off: (channel: string, listener: (...args: any[]) => void) => void
    once: (channel: OnceChannel, listener: (...args: any[]) => void) => void
    send: (channel: string, ...args: any[]) => void
    // 最小化app
    minimizeApp: () => void
    // 关闭app
    closeApp: () => void
    getVideoSize: (id: string) => Promise<number>
    downloadVideo: (task: TaskData) => void
    openBrowser: (url: string) => void
    openDirDialog: () => Promise<string>
    // 检测下载路径是否存在
    checkDownaldPathExist: () => boolean
    saveDanmukuFile: (content: string, path: string) => void
    setStore: <T = any>(path: string, data: T) => void
    deleteStore: (path: string) => void
    showContextmenu: (type: MenuType) => Promise<ReplyMenuType>
    openPath: (path: string) => void
    openReloadVideoDialog: (taskCount: number) => Promise<Electron.MessageBoxReturnValue>
    openDir: (list: string[]) => void
    // got: typeof got
    [key: string]: any
  }
  log: any
}
