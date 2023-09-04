import UserAgent from 'user-agents'

const userAgent = new UserAgent({
  userAgent: /Chrome/,
  deviceCategory: 'desktop'
})
function randUserAgent () {
  return userAgent.random().toString()
}

export {
  randUserAgent
}
