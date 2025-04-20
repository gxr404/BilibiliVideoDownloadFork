<template>
  <a-modal
    wrapClassName="custom-modal-padding"
    :visible="visible"
    :confirmLoading="confirmLoading"
    :okButtonProps="{ disabled: !(quality !== -1 && selected.length !== 0) }"
    :closable="false"
    :maskClosable="false"
    title="当前视频信息"
    okText="下载"
    cancelText="取消"
    :width="(videoInfo?.page && videoInfo?.page.length) > 40 ? 700 : undefined"
    @cancel="cancel"
    @ok="handleDownload">
    <div class="video-modal custom-scroll-bar">
      <div class="video-info fr">
        <div class="image">
          <a-image :src="videoInfo.cover" />
        </div>
        <div class="content fc jsa pl16">
          <div class="text-active ellipsis-2" @click="openBrowser(videoInfo.url)">{{ videoInfo.title }}</div>
          <div class="ellipsis-1">up：<span v-for="(item, index) in videoInfo.up" :key="index" class="text-active mr8" @click="openBrowser(`https://space.bilibili.com/${item.mid}`)">{{item.name}}</span></div>
        </div>
      </div>
      <div class="mt16">
        选择清晰度：
        <div class="mt8" v-if="videoInfo.qualityOptions.length <= 0">
          <p class="err-msg">o(╥﹏╥)o 无法获取清晰度列表</p>
          <p class="err-msg" v-if="store.baseStore().loginStatus !== 2">
          当前账号为「<span style="font-weight: bold;">{{store.baseStore().loginStatus === 1 ? '普通用户' : '游客'}}</span>」,请确认该视频是否是会员视频
          </p>
        </div>
        <div class="mt8" v-else>
          <a-radio-group v-model:value="quality">
            <a-radio class="custom-radio" v-for="(item, index) in videoInfo.qualityOptions" :key="index" :value="item.value">
              {{ item.label }}
            </a-radio>
          </a-radio-group>
        </div>
      </div>
      <div v-if="videoInfo.page && videoInfo.page.length > 1" class="fr ac jsb mt16">
        <div>这是一个多P视频，请选择</div>
        <div>
          <a-checkbox @change="onAllSelectedChange">
            全选
          </a-checkbox>
          <a-checkbox v-model:checked="saveFilePrefix">
            保留[P?]
          </a-checkbox>
        </div>
      </div>
      <!-- <div v-if="videoInfo.page[0]?.longTitle" class="fr ac jsb mt16">
        <div>&nbsp;</div>
        <div>
          <a-checkbox v-model:checked="showLongTitle">
            显示长标题
          </a-checkbox>
        </div>
      </div> -->
      <template v-if="videoList.length> 1">
      <!-- {{ selected }} -->
        <a-tabs v-model:activeKey="videoListActive">
          <a-tab-pane
            v-for="(videoListItem, tabIndex) in videoList"
            :key="`videoList-${tabIndex}`"
            :tab="videoListItem.title">
            <div class="fr ac warp mt16 video-content">
              <template v-for="(item, index) in videoListItem.data" :key="`videoList-${tabIndex}-${index}`">
                <a-tooltip>
                    <template #title>
                      {{ item.longTitle || item.title }}
                    </template>
                  <div
                    :class="['video-item', selected.includes(item.page) ? 'active' : '',
                    store.baseStore().loginStatus !== 2 && item.badge=== '会员' ? 'disable' : '' ]"
                    @click="toggle(item.page, store.baseStore().loginStatus !== 2 && item.badge=== '会员')">
                    <span class="badge" :data-content="item.badge">{{item.badge}}</span>
                    <!-- <span class="ep-title" v-if="Boolean(item.epTitle)">{{ item.epTitle }}</span> -->
                    <span class="ellipsis-1">{{ item.showTitle || item.title }}</span>
                  </div>
                </a-tooltip>
              </template>
            </div>
          </a-tab-pane>
        </a-tabs>
      </template>
      <template v-else>
        <div v-if="videoInfo.page && videoInfo.page.length > 1" class="fr ac warp mt16 video-content">
          <template v-for="(item, index) in videoInfo.page" :key="`main-${index}`">
            <a-tooltip>
                <template #title>
                  {{ item.longTitle || item.title }}
                </template>
              <div
                :class="['video-item', selected.includes(item.page) ? 'active' : '',
                store.baseStore().loginStatus !== 2 && item.badge=== '会员' ? 'disable' : '' ]"
                @click="toggle(item.page, store.baseStore().loginStatus !== 2 && item.badge=== '会员')">
                <span class="badge" :data-content="item.badge">{{item.badge}}</span>
                <!-- <span class="ep-title" v-if="Boolean(item.epTitle)">{{ item.epTitle }}</span> -->
                <span class="ellipsis-1">{{ item.title }}</span>
              </div>
            </a-tooltip>
          </template>
        </div>
      </template>
    </div>
  </a-modal>
</template>

<script lang="ts" setup>
import { computed, ref, toRaw } from 'vue'
import { useRouter } from 'vue-router'
import { store } from '../../store'
import { getDownloadList, addDownload } from '../../core/bilibili'
import { userQuality } from '../../assets/data/quality'
import { VideoData } from '../../type'
import { videoData } from '../../assets/data/default'
import { STATUS } from '../../assets/data/status'

const visible = ref<boolean>(false)
const confirmLoading = ref<boolean>(false)
const quality = ref<number>(-1)
const videoInfo = ref<VideoData>(videoData)
const selected = ref<number[]>([])
const allSelected = ref<boolean>(false)
const router = useRouter()
const saveFilePrefix = ref<boolean>(true)
const videoListActive = ref('videoList-0')

const videoList = computed(() => {
  if (!Array.isArray(videoInfo.value.page) || videoInfo.value.page.length <= 1) {
    return []
  }
  const res = []
  const temp: any = {}
  videoInfo.value.page.forEach(item => {
    const sectionsTitle = item.sectionsTitle || '正片'
    if (!Array.isArray(temp[sectionsTitle])) {
      temp[sectionsTitle] = []
    }
    temp[sectionsTitle].push(item)
  })
  for (const sectionsTitle in temp) {
    res.push({
      title: sectionsTitle,
      data: temp[sectionsTitle]
    })
  }

  return res
})

const cancel = () => {
  visible.value = false
  confirmLoading.value = false
  quality.value = -1
  selected.value = []
}

const handleDownload = async () => {
  confirmLoading.value = true
  // 获取当前选中视频的下载数据
  const list = await getDownloadList(toRaw(videoInfo.value), toRaw(selected.value), quality.value, undefined, undefined, saveFilePrefix.value)
  console.log('list-->', list)
  const taskList = addDownload(list)
  store.taskStore().setTask(taskList)
  let count = 0
  let selectedTask = ''
  for (const key in taskList) {
    const task = taskList[key]
    if (task.status === STATUS.PLAN_START) {
      window.electron.downloadVideo(task)
      count += 1
      if (!selectedTask) selectedTask = task.id
    }
    // await sleep(300)
  }
  store.baseStore().addDownloadingTaskCount(count)
  confirmLoading.value = false
  visible.value = false
  store.taskStore().setRightTaskId(selectedTask)
  router.push({ name: 'download' })
}

const open = (data: VideoData) => {
  saveFilePrefix.value = true
  const quality = userQuality[store.baseStore().loginStatus]
  // 过滤掉 不合法的清晰度
  data.qualityOptions = data.qualityOptions.filter((item: any) => quality.includes(item.value))
  videoInfo.value = data
  visible.value = true
  // 如果是单p，则默认选中
  if (videoInfo.value.page.length === 1) {
    selected.value.push(videoInfo.value.page[0].page)
  }
}

const onAllSelectedChange = (e: any) => {
  allSelected.value = e.target.checked
  selected.value = []
  if (e.target.checked) {
    videoInfo.value.page.forEach((element: any) => {
      if (element.badge === '会员') {
        if (store.baseStore().loginStatus === 2) selected.value.push(element.page)
      } else {
        selected.value.push(element.page)
      }
    })
  }
}

const toggle = (page: number, disable: boolean) => {
  if (disable) return
  const index = selected.value.indexOf(page)
  if (index === -1) {
    selected.value.push(page)
  } else {
    selected.value.splice(index, 1)
  }
}

const openBrowser = (url: string) => {
  window.electron.openBrowser(url)
}

defineExpose({
  open
})

</script>

<style scoped lang="less">
.video-modal{
  height: 260px;
  overflow-y: overlay;
  padding-left: 12px;
  .video-info{
    height: 71.25px;
    .image{
      flex: none;
      width: 114px;
      overflow: hidden;
      position: relative;
      img{
        display: block;
        width: 100%;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      }
    }
    .content{
      box-sizing: border-box;
      flex: none;
      width: 358px;
    }
  }
  .video-content {
    justify-content: flex-start;
  }
  .video-item{
    display: flex;
    justify-content: center;
    align-items: center;
    box-sizing: border-box;
    // width: 100px;
    height: 50px;
    max-width: 140px;
    min-width: 50px;
    border: 1px solid #eeeeee;
    background: #ffffff;
    margin: 0px 18px 18px 0px;
    padding: 8px;
    cursor: pointer;
    // overflow: hidden;
    border-radius: 6px;
    user-select: none;
    position: relative;
    &:hover {
      background-color: @primary-color3;
      border: 1px solid @primary-color2;
      color: @primary-color2;
    }
    &.active{
      color: #ffffff;
      background: @primary-color2;
      border: 1px solid @primary-color2;
    }
    &.disable {
      cursor: no-drop;
      color: #ddd;
      background-color: #fff;
      border: 1px solid #ddd;
    }
    .badge {
      position: absolute;
      font-size: 12px;
      background: @primary-color;
      right: -1px;
      top: -1px;
      color:#ffffff;
      padding: 0 4px;
      border-bottom-left-radius: 10px;
      border-top-right-radius: 6px;
      &[data-content="限免"] {
        background-color: rgb(255, 127, 36);
      }
      &[data-content="预告"] {
        background-color: rgb(0, 192, 255);
      }
    }
    .ep-title {
      position: absolute;
      font-size: 12px;
      color: #ffffff;
      background: @primary-color2;
      top: -12px;
      left: -10px;
      padding: 0 4px;
      border-radius: 4px;
      max-width: 80px;
      overflow: hidden;
      height: 20px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
  .err-msg {
    text-align: center;
    color: @primary-color;
  }
}
.custom-radio{
  width: 150px;
}
</style>
