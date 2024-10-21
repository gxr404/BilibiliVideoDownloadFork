import UserAgent from 'user-agents'

const userAgent = new UserAgent({
  userAgent: /Chrome/,
  deviceCategory: 'desktop'
})
function randUserAgent () {
  return `${userAgent.random().toString()} ${Math.floor(Math.random() * 100000)}`
}

export {
  randUserAgent
}
