const formConfig = [
  {
    label: '登录状态',
    type: 'status',
    name: '',
    tips: '登录后账号是普通账号最大下载1080P视频，大会员可以下载4K视频，不登录最大下载480P视频'
  },
  {
    label: '下载地址',
    placeholder: '请设置下载地址',
    type: 'downloadPath',
    name: 'downloadPath',
    tips: '没有设置下载地址不能下载'
  },
  {
    label: '文件命名格式',
    type: 'select',
    name: 'formatFileNameVal',
    value: 0,
    options: [
      {
        value: 0,
        label: 'up-tilte-bvid-id',
        default: true
      },
      {
        value: 1,
        label: 'title-bvid'
      },
      {
        value: 2,
        label: 'title-id'
      },
      {
        value: 3,
        label: 'tilte (最精简相同标题可能覆盖)'
      }
    ],
    tips: '保存的文件名或文件夹名的格式'
  },
  {
    label: '最大下载数',
    type: 'slider',
    name: 'downloadingMaxSize',
    tips: '没有选择同时下载的最大下载数不能下载'
  },
  {
    label: '下载成功后是否进行转码合并',
    type: 'switch',
    name: 'isMerge',
    tips: '下载的源文件是音视频分离的m4s文件，故需要合并'
  },
  {
    label: '下载成功后是否删除原视频',
    type: 'switch',
    name: 'isDelete',
    tips: '删除合并前的m4s文件'
  },
  {
    label: '下载到单独文件夹',
    type: 'switch',
    name: 'isFolder',
    tips: '开启后每个任务会下载到一个单独的文件夹里面'
  },
  {
    label: '下载字幕',
    type: 'switch',
    name: 'isSubtitle',
    tips: '开启后如果检测到当前下载视频有字幕则会下载'
  },
  {
    label: '下载弹幕',
    type: 'switch',
    name: 'isDanmaku',
    tips: '开启后会下载视频当前弹幕'
  },
  {
    label: '下载封面',
    type: 'switch',
    name: 'isCover',
    tips: '开启后会下载视频封面'
  }
]

const settingData = {
  downloadPath: '',
  isMerge: true,
  isDelete: true,
  isSubtitle: true,
  isDanmaku: true,
  isFolder: true,
  isCover: true,
  downloadingMaxSize: 5,
  formatFileNameVal: 0
}

const settingRules = {
  downloadPath: [
    {
      required: true,
      message: '请设置下载地址'
    }
  ],
  downloadingMaxSize: [
    {
      required: true,
      message: '请选择同时下载的最大下载数'
    }
  ],
  isMerge: [
    {
      required: false
    }
  ],
  isDelete: [
    {
      required: false
    }
  ],
  isFolder: [
    {
      required: false
    }
  ],
  isSubtitle: [
    {
      required: false
    }
  ],
  isDanmaku: [
    {
      required: false
    }
  ],
  isCover: [
    {
      required: false
    }
  ],
  formatFileNameVal: [
    {
      required: false
    }
  ]
}

const formItemLayout = { span: 24, offset: 0 }

const loginStatusText = ['未登录', '普通用户', '大会员']

export {
  settingData,
  formConfig,
  formItemLayout,
  settingRules,
  loginStatusText
}
