<template>
  <a-modal
    wrapClassName="custom-modal-padding"
    :open="visible"
    :closable="false"
    :maskClosable="false"
    title="请登录Bilibili"
    :okText="handleOkText()"
    :okButtonProps="{ disabled: (activeTab === 1 && scanStatus !== 2 ) || (activeTab === 2 && !IPTSESSDATA) }"
    cancelText="不登录"
    @cancel="notLogin"
    @ok="login">
    <a-tabs v-model:activeKey="activeTab" centered>
      <a-tab-pane :key="1" tab="扫码登录" force-render>
        <div class="login-box">
          <div class="qr-modal" v-if="!countDown && !isQrLoad">
            <SyncOutlined class="refresh" @click="createQrcode" />
          </div>
          <div class="qr-modal" v-if="isQrLoad" >
            <LoadingOutlined class="loading" />
          </div>
          <img v-if="imageBase64" :src="imageBase64" alt="" />
        </div>
      </a-tab-pane>
      <a-tab-pane :key="2" tab="手动输入">
        <div class="login-box">
          <a-input v-model:value="IPTSESSDATA" placeholder="输入你的SESSDATA">
            <template #suffix>
              <a-tooltip>
                <template #title>
                  <a @click="openBrowser('https://github.com/blogwy/BilibiliVideoDownload/wiki/%E8%8E%B7%E5%8F%96SESSDATA')">点击此处</a>查看如何获取SESSDATA
                </template>
                <InfoCircleOutlined style="color: rgba(0, 0, 0, 0.45)" />
              </a-tooltip>
            </template>
          </a-input>
        </div>
      </a-tab-pane>
    </a-tabs>
    <div class="mt16 desc">注：软件登录后只会获取你的SESSDATA来用做下载，账号是普通账号下载1080P视频，大会员可以下载8K视频，不登录下载480P视频</div>
  </a-modal>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { message } from 'ant-design-vue'
import { InfoCircleOutlined, SyncOutlined, LoadingOutlined } from '@ant-design/icons-vue'
import qrCode from 'qrcode'
import { checkLogin } from '../../core/bilibili'
import { store } from '../../store'

const visible = ref<boolean>(false)
// 0 未扫码 1 已扫码 2 已确认
const scanStatus = ref<number>(0)
const activeTab = ref<number>(1)
const QRSESSDATA = ref<string>('')
const IPTSESSDATA = ref<string>('')
const imageBase64 = ref<string>('')
const oauthKey = ref<string>('')
const countDown = ref<number>(180)
const isCheck = ref<boolean>(true)
const isQrLoad = ref(false)
let timer: number | null = null
let checkStatusTimer: number | null = null

const handleOkText = () => {
  const okText = ['未扫码', '已扫码', '确认登录']
  if (activeTab.value === 1) {
    return okText[scanStatus.value]
  } else {
    return '确认登录'
  }
}

const open = async () => {
  visible.value = true
  await createQrcode()
  isCheck.value = true
  checkScanStatus(oauthKey.value)
}

const notLogin = () => {
  store.baseStore().setAllowLogin(false)
  hide()
}

const login = async () => {
  // 获取SESSDATA
  const SESSDATA = activeTab.value === 1 ? QRSESSDATA.value : IPTSESSDATA.value
  if (activeTab.value === 1 && !SESSDATA) {
    message.error('请输入SESSDATA')
    return
  }
  // 储存SESSDATA
  store.settingStore().setSESSDATA(SESSDATA)
  // 验证SESSDATA
  const { status, face, mid } = await checkLogin(store.settingStore().SESSDATA)
  // 储存LoginStatus
  store.baseStore().setLoginStatus(status)
  store.settingStore().setFace(face)
  store.settingStore().setDedeUserID(mid)
  hide()
}

const hide = () => {
  isCheck.value = false
  setTimeout(() => {
    if (typeof timer === 'number') clearInterval(timer)
    timer = null
  }, 1000)
  if (typeof checkStatusTimer === 'number') clearTimeout(checkStatusTimer)
  visible.value = false
}

const openBrowser = (url: string):void => {
  window.electron.openBrowser(url)
}

const generateQRcodeAPI = 'https://passport.bilibili.com/x/passport-login/web/qrcode/generate'
const createQrcode = async () => {
  isQrLoad.value = true
  const { body } = await window.electron.got(generateQRcodeAPI, {
    responseType: 'json'
  })

  const qrcode = await qrCode.toDataURL(body.data.url, {
    margin: 0,
    errorCorrectionLevel: 'H',
    width: 400
  })
  imageBase64.value = qrcode
  isQrLoad.value = false
  oauthKey.value = body.data.qrcode_key || ''
  // 开始倒计时
  countDown.value = 180
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  timer = window.setInterval(() => {
    if (!countDown.value) {
      if (typeof timer === 'number') clearInterval(timer)
      return
    }
    countDown.value -= 1
  }, 1000)
}
const QRCodeAPI = 'https://passport.bilibili.com/x/passport-login/web/qrcode/poll'
const checkScanStatus = (oauthKey: string) => {
  run(oauthKey)
  async function run (oauthKey: string) {
    if (!isCheck.value) return
    const { body } = await window.electron.got(QRCodeAPI, {
      method: 'GET',
      responseType: 'json',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      searchParams: {
        qrcode_key: oauthKey
      }
    }).catch((e: unknown) => {
      console.log(e)
    })
    const defaultData = {
      code: -999999
    }
    const {
      data = defaultData
    } = body
    console.log(data)
    // 非扫码登录成功
    if (data.code !== 0) {
      //  86101：未扫码
      if (data.code === 86101) {
        scanStatus.value = 0
      }
      // 86090：二维码已扫码未确认
      if (body.data === 86090) {
        scanStatus.value = 1
      }
      if (visible.value) {
        checkStatusTimer = window.setTimeout(() => {
          run(oauthKey)
        }, 3000)
      }

      // 0：扫码登录成功
      // 86038：二维码已失效
      // 86090：二维码已扫码未确认
      // 86101：未扫码
      return
    }
    // 获取SESSDATA
    QRSESSDATA.value = body.data.url.match(/SESSDATA=(\S*)&bili_jct/)[1]
    scanStatus.value = 2
    isCheck.value = false
  }
}

defineExpose({
  open
})
</script>

<style scoped lang="less">
.login-box{
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  .qr-modal{
    width: 200px;
    height: 200px;
    position: absolute;
    top: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(190, 190, 190, 0.8);
    z-index: 10;
    .refresh{
      // position: absolute;
      // top: 50%;
      // left: 50%;
      // transform: translate(-50%, -50%);
      z-index: 11;
      font-size: 24px;
      color: @primary-color;
    }
    .loading {
      z-index: 11;
      font-size: 24px;
      color: @primary-color;
    }
  }
  img{
    width: 200px;
    height: 200px;
  }
}
</style>
