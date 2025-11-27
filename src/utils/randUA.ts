import UserAgent from 'user-agents'

export const userAgent = new UserAgent({
  userAgent: /^(?=.*Chrome)(?!.*Edg).*/,
  platform: 'MacIntel',
  deviceCategory: 'desktop'
})
function randUserAgent () {
  return `${userAgent.random().toString()} ${String(Math.floor(Math.random() * 100000)).padStart(6, '0')}`
}

export {
  randUserAgent
}
