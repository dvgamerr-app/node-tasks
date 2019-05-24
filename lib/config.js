const { task } = require('@touno-io/db/schema')

module.exports = {
  getConfigTask: async (job = '') => {
    await task.open()
    const { ConfigTask } = task.get()
    return await ConfigTask.findOne({ job })
  },
  getConfig: async (scope = '') => {
    let { groups } = /(?<scope>.*)?\.(?<key>.*)/ig.exec(scope) || { groups: { key: scope, scope: '' } }

    await task.open()
    const { Config } = task.get()
    return await Config.findOne(groups, 'value')
  }
}
