import UserAgent from 'user-agents'

export const userAgent = new UserAgent({
  userAgent: /^(?=.*Chrome)(?!.*Edg).*/,
  // platform: 'MacIntel',
  deviceCategory: 'desktop'
})

let ua = `${userAgent.random().toString()} ${String(Math.floor(Math.random() * 100000)).padStart(6, '0')}`

function getUserAgent () {
  return ua
}

function resetUA () {
  ua = `${userAgent.random().toString()} ${String(Math.floor(Math.random() * 100000)).padStart(6, '0')}`
}

export {
  getUserAgent,
  resetUA
}
