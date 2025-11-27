import { customAlphabet } from 'nanoid'
import alphabet from '@/assets/data/alphabet'

export const nanoid = customAlphabet(alphabet, 16)

export function parseCookie (cookieStr: string) {
  const cookie: any = {}
  cookieStr.split(';').forEach((item) => {
    const [k, v] = item.split('=')
    if (k) {
      cookie[k] = v
    }
  })
  return cookie
}

export function toCookieStr (cookieObj: any = {}) {
  return Object.keys(cookieObj).map(k => {
    return `${k}=${cookieObj[k]}`
  }).join('; ') + ';' || ''
}
