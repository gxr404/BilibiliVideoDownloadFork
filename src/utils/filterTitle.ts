export const filterTitle = (title: string) => {
  const pattern = /[「」`~!@#$^&*()=|{}':;\',\[\]\.<>\/?~！@#￥……&*（）——|{}【】'；：""'。，、？]/g
  return title.replace(pattern, '').replace(/\s/g, '_')
}

interface IFormatFileNameData {
  up: string,
  title: string,
  bvid: string,
  id: string,
}

export function formatFileName (settingFormatFileName = 0, data: IFormatFileNameData): string {
  const { up, title, bvid, id } = data
  const formateMap = new Map([
    [0, filterTitle(`${up ? `${up}-` : ''}${title}-${bvid}-${id}`)],
    [1, filterTitle(`${title}-${bvid}`)],
    [2, filterTitle(`${title}-${id}`)],
    [3, filterTitle(`${title}`)]
  ])
  return formateMap.get(settingFormatFileName) || filterTitle(`${up ? `${up}-` : ''}${title}-${bvid}-${id}`)
}
