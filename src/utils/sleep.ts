export const sleep = (timeoutMS: number) => new Promise((resolve) => {
  setTimeout(resolve, timeoutMS)
})
