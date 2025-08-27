<template>
  <a-config-provider
    :locale="zhCN"
    :theme="{
      token: {
        colorPrimary: '#fb7299'
      },
    }">
    <!-- <TabBar /> -->
    <CheckUpdate ref="checkUpdate" />
    <div class="warp">
      <TitleBar
        :title="pageInfo.productName"
        :isBackground="false"
        :isMinimizable="true"
        :isMaximizable="false"
        @onClose="onClose"
        @onMinimize="onMinimize"
      />
      <div class="content">
        <div class="sidebar">
          <div class="top-menu">
            <div :class="['item', route.name === 'home' ? 'active' : '']">
              <HomeOutlined :style="{fontSize: '20px'}" @click="goHome()" />
            </div>
            <div :class="['item', route.name === 'download' ? 'active' : '']">
              <DownloadOutlined :style="{fontSize: '20px'}" @click="goDownloadList()" />
            </div>
          </div>
          <div class="menu">
            <div class="item">
              <div class="vip-warp">
                <div class="vip-flag" v-if="store.baseStore().loginStatus === 2">
                  <CrownFilled />
                </div>
                <UserOutlined v-if="store.baseStore().loginStatus === 0" :style="{fontSize: '22px'}" @click="login()" />
                <div v-else class="user-face">
                  <a-popconfirm
                    title="你确定要退出登录吗?"
                    ok-text="是"
                    cancel-text="否"
                    placement="right"
                    @confirm="quitLogin"
                  >
                    <img :src="store.settingStore().face" alt="userFace">
                  </a-popconfirm>
                </div>
              </div>
            </div>
            <div class="item">
              <SettingOutlined :style="{fontSize: '22px'}" @click="settingDrawer?.open()" />
            </div>
            <div class="item">
              <InfoCircleOutlined :style="{fontSize: '22px'}" @click="userModal?.toggleVisible()" />
            </div>
          </div>
        </div>
        <router-view/>
      </div>
    </div>

    <UserModal ref="userModal" />
    <SettingDrawer ref="settingDrawer" />
    <LoginModal ref="loginModal" />

  </a-config-provider>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import zh_CN from 'ant-design-vue/es/locale/zh_CN'
import { UserOutlined, HomeOutlined, DownloadOutlined, SettingOutlined, InfoCircleOutlined, CrownFilled } from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import TitleBar from './components/TitleBar/index.vue'
// import TabBar from './components/TabBar/index.vue'
import CheckUpdate from './components/CheckUpdate/index.vue'
import { pinia, store } from './store'
import { checkLogin, addDownload } from './core/bilibili'
import { SettingData, TaskData, TaskList } from './type'
import { STATUS } from './assets/data/status'
import UserModal from './components/UserModal/index.vue'
import LoginModal from './components/LoginModal/index.vue'
import SettingDrawer from './components/SettingDrawer/index.vue'
import pageInfo from '../package.json'
import { nanoid } from './utils'

const router = useRouter()
const route = useRoute()

type SettingDrawerInstance = InstanceType<typeof SettingDrawer>
const settingDrawer = ref<SettingDrawerInstance | null>(null)
type UserModalInstance = InstanceType<typeof UserModal>
const userModal = ref<UserModalInstance | null>(null)
type LoginModalInstance = InstanceType<typeof LoginModal>
const loginModal = ref<LoginModalInstance | null>(null)
const isLogin = ref(false)

dayjs.locale('zh-cn')
const zhCN = ref(zh_CN)
type CheckUpdateInstance = InstanceType<typeof CheckUpdate>
const checkUpdate = ref<CheckUpdateInstance | null>(null)

const onMinimize = () => {
  window.electron.minimizeApp()
}

const onClose = () => {
  window.electron.closeApp()
}

function goHome () {
  router.push({ name: 'home' })
}

function goDownloadList () {
  router.push({ name: 'download' })
}

function login () {
  loginModal.value?.open()
}
function quitLogin () {
  store.baseStore().setLoginStatus(0)
  store.settingStore().setSESSDATA('')
  store.settingStore().setFace('')
}

async function downloadVideoStatusHandle ({ id, status, progress, size = -1 }: { id: string, status: number, progress: number, size?: number }) {
  const tempTask = store.taskStore(pinia).getTask(id)
  // console.log('[downloadVideoStatusHandle]: ', id, status, progress, tempTask)
  if (tempTask && tempTask.status === STATUS.FAIL) return
  // isReDownload??
  // 如果出现进度倒退的情况 则抛弃此次 download-video-status, 失败的情况特殊 因为无 progress
  if (
    status !== STATUS.FAIL &&
    tempTask && tempTask?.progress &&
    tempTask?.progress > progress
  ) {
    return
  }

  const task = tempTask
    ? JSON.parse(JSON.stringify(tempTask))
    : null
  // 成功和失败 更新 pinia electron-store，减少正在下载数；检查taskList是否有等待中任务，有则下载
  if (task && ([STATUS.COMPLETED, STATUS.FAIL] as number[]).includes(status)) {
    window.log.info(`${id} ${status}`)
    // let size = -1
    let _progress = progress
    // 避免Fial是进度条倍清空
    if (status === STATUS.COMPLETED) {
      _progress = typeof _progress === 'number' ? _progress : task.progress
    }
    const setTaskData = { ...task, status, progress: _progress }
    if (status === STATUS.COMPLETED) {
      console.log('[render-videosize]: ', size)
      setTaskData.size = size
    }
    store.taskStore(pinia).setTask([setTaskData], false)
    store.baseStore(pinia).reduceDownloadingTaskCount(1)
    // 检查下载
    const taskList = store.taskStore(pinia).taskList
    let allowDownload: TaskData[] = []
    taskList.forEach((value) => {
      if (value.status === STATUS.PENDING) {
        allowDownload.push(JSON.parse(JSON.stringify(value)))
      }
    })
    allowDownload = addDownload(allowDownload)
    let count = 0
    const _tempList: TaskData[] = []
    for (const key in allowDownload) {
      const item = allowDownload[key]
      if (item.status === STATUS.PLAN_START) {
        // window.electron.downloadVideo(item)
        _tempList.push(item)
        count += 1
      }
      // await sleep(300)
    }
    if (_tempList.length > 0) {
      window.electron.downloadVideoList(_tempList)
    }
    store.baseStore(pinia).addDownloadingTaskCount(count)
  }
  // 视频下载中 音频下载中 合成中 只更新pinia
  if (task && ([
    STATUS.PLAN_START,
    STATUS.VIDEO_DOWNLOADING,
    STATUS.AUDIO_DOWNLOADING,
    STATUS.MERGING
  ] as number[]).includes(status)) {
    store.taskStore(pinia).setTaskEasy([{ ...task, status, progress }])
  }
}

let id: string
onMounted(() => {
  id = nanoid()
  // 初始化pinia数据
  window.electron.once('init-store', async ({ setting, taskList }: { setting: SettingData, taskList: TaskData[] }) => {
    store.settingStore(pinia).setSetting(setting)
    const { status: loginStatus, face } = await checkLogin(store.settingStore(pinia).SESSDATA)
    store.baseStore(pinia).setLoginStatus(loginStatus)
    if (loginStatus !== 0) {
      isLogin.value = true
      store.settingStore().setFace(face)
    }
    const taskMap: TaskList = new Map()
    for (const key in taskList) {
      const task = taskList[key]
      taskMap.set(task.id, task)
    }
    store.taskStore(pinia).setTaskList(taskMap)
    const taskId = store.taskStore(pinia).taskListArray[0] ? store.taskStore(pinia).taskListArray[0][0] : ''
    if (taskId) store.taskStore(pinia).setRightTaskId(taskId)
  })
  // 监听下载进度
  window.electron.on('download-video-status', id, downloadVideoStatusHandle)

  // // 下载弹幕
  // window.electron.on('download-danmuku', id, (cid: number, title: string, path: string) => {
  //   downloadDanmaku(cid, title, path)
  // })

  // 检查软件更新
  checkUpdate.value?.checkUpdate()
})

onUnmounted(() => {
  if (id) window.electron.off('download-video-status', id)
})
</script>

<style lang="less" scoped>
.warp {
  display: flex;
  height: 100vh;
  flex-wrap: wrap;
}
.content {
  display: flex;
  margin-top: -28px;
  box-sizing: border-box;
  padding-top: 28px;
  height: 100%;
  width: 100%;
}
.sidebar {
  display: flex;
  flex-wrap: wrap;
  width: 66px;
  height: 100%;
  background-color: #1f2022;
  .top-menu {
    width: 100%;
    .item {
      padding-top: 20px;
    }
  }
  .menu {
    width: 100%;
    flex: 1;
    display: flex;
    align-content: flex-end;
    flex-wrap: wrap;
    .item {
      padding-bottom: 20px;
    }
  }
  .item {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #a1a5ad;
    &:hover {
      color: @primary-color;
    }
    &.active {
      color: @primary-color;
    }
  }
  .user-face {
    position: relative;
    z-index: 1;
    width: 24px;
    height: 24px;
    overflow: hidden;
    border-radius: 50%;
    cursor: pointer;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s;
    border: 1px solid transparent;
    // border: 1px solid #a1a5ad;
    &:hover {
      border: 1px solid @primary-color;
    }
    img {
      width: 100%;
    }
  }
  .vip-warp {
    position: relative;
    z-index: 0;
    .vip-flag {
      position: absolute;
      top: -7px;
      right: -5px;
      color: #feca2c;
      font-size: 12px;
      transform: scale(0.8) rotate(45deg);
      z-index: 0;
    }
  }

}

</style>
