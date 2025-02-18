<template>
  <a-modal
    v-model:visible="visible"
    :closable="true"
    :footer="null">
    <div class="user fc ac">
      <img src="../../assets/images/user.png" alt="" class="avatar">
      <div class="version mt16">
        {{ `${productName} - v${version}` }} <ReloadOutlined :class="['check-update-btn', isCheckingUpdate ? 'rotate' : '']" @click="onCheckVersionUpdate" />
      </div>
      <div class="git mt16">项目地址：<span class="text-active" @click="openBrowser(projectUrl)">{{ projectUrl }}</span></div>
      <div class="desc mt16">代码稀烂，大佬轻喷，如有问题，<span class="text-active" @click="openBrowser(`${projectUrl}/issues`)">请点这里</span></div>
      <div class="desc-sm">该项目是个Fork项目(主要为了修复 Bug)，并非原创。<span class="text-active" @click="openBrowser('https://github.com/BilibiliVideoDownload/BilibiliVideoDownload')">原项目地址</span></div>

    </div>
  </a-modal>
  <CheckUpdate ref="checkUpdateRef" />
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { ReloadOutlined } from '@ant-design/icons-vue'
import CheckUpdate from '../CheckUpdate/index.vue'
import packageInfo from '../../../package.json'

const checkUpdateRef = ref<any>(null)
const visible = ref<boolean>(false)
const productName = ref<string>(packageInfo.productName)
const version = ref<string>(packageInfo.version)
const projectUrl = ref<string>(packageInfo.homepage)
const isCheckingUpdate = ref(false)

const toggleVisible = () => {
  visible.value = !visible.value
}
const openBrowser = (url: string):void => {
  window.electron.openBrowser(url)
}

async function onCheckVersionUpdate () {
  if (!checkUpdateRef.value) {
    console.warn('checkUpdate ref not found')
    return
  }
  isCheckingUpdate.value = true
  await checkUpdateRef.value.checkUpdate()
  isCheckingUpdate.value = false
}

defineExpose({
  toggleVisible
})
</script>

<style scoped lang="less">
.user{
  .avatar{
    width: 150px;
    border: 1px solid #eeeeee;
    border-radius: 50%;
  }
}
.desc-sm {
  font-size: 12px;
  color: #ccc;
  margin-top: 2px;
  .text-active {
    color: #ccc;
    text-decoration: dashed;
    text-decoration: underline;
    cursor: pointer;
    &:hover {
      color: #fb7299;
    }
  }
}
.check-update-btn {
  &:hover {
    color: #fb7299;

  }
}
.rotate {
  animation: rotate .4s linear infinite;
}
@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

</style>
