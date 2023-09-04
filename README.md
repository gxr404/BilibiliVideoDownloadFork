<div align="center">
  <img src="./build/icons/256x256.png" alt="" width="128">
  <h1>BilibiliVideoDownload</h1>
</div>


## ⚠️Buf修复⚠️

***由于[原项目](https://github.com/BilibiliVideoDownload/BilibiliVideoDownload)已经好久没人维护，无人修复bug，因此fork该库修复bug，优化功能体验***

- [x] 💪 新增新版接口合集视频获取
- [x] 💪 增加下载失败时重新下载按钮
- [x] 💪 优化体验，下载列表右击即选中
- [x] 🛠️ 修复多任务重复下载任务
- [x] 🛠️ 修复下载失败，右击菜单重新下载时新增任务而不是在原任务的基础上重新下载
- [ ] 下载番剧视频(待定还不知是否做得到)
- [ ] 暂停/恢复下载

## 注意

- 软件不支持付费视频和地区限制视频，可能会报错
- 登录信息有过期时间，好像是半年
- 由于下载的音视频是分离的，项目使用ffmpeg合成导致安装包有点大(ffmpeg大约70+MB)

## 安装

到[releases](https://github.com/gxr404/BilibiliVideoDownloadFork/releases)页面,下载对应平台安装包即可.下载视频时候会提示登录，登录后只会获取你的SESSDATA来用做下载，账号是普通账号最大支持下载1080P视频，大会员可以下载8K视频，不登录最大支持下载480P视频

## 演示

![1](./screenshots/1.png)
![2](./screenshots/2.png)
![3](./screenshots/3.png)
