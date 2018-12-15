const { touno } = require('@touno-io/db/mongo')
const { debuger, Raven } = require('@touno-io/debuger')
const cron = require('cron')
const moment = require('moment')

const logger = debuger.scope('crontab')

let core = []
let RefreshCrontab = async (db, frequency) => {
  for (let i = 0; i < core.length; i++) {
    const { ID, OnJob } = core[i]
    let schedule = await db.Touno.findOne({ group: 'crontab', item: ID })
    if (schedule && schedule.data.reload) {
      await db.Touno.updateOne({ _id: schedule._id }, { $set: { 'data.reload': false, 'data.started': false } })
      OnJob.stop()
      OnJob.setTime(new cron.CronTime(schedule.data.time))
      await logger.info(`TaskId: '${ID}' Restarted is next at ${moment(OnJob.nextDates()).format('DD MMMM YYYY HH:mm:ss')}`)
      await debuger.Audit(`${ID} is restart next at ${moment(OnJob.nextDates()).format('DD MMMM YYYY HH:mm:ss')}`, 'success')
      await db.Touno.updateOne({ _id: schedule._id }, { $set: { 'data.started': true } })
      OnJob.start()
    }
  }
  setTimeout(() => RefreshCrontab(db, frequency), frequency)
}

module.exports = opt => Raven.Tracking(async () => {
  let db = await touno.open()
  Raven.ProcessClosed(process, db.close)
  let schedule = await db.Touno.findOne({ group: 'crontab', item: opt.id })

  if (!opt.id || !schedule) throw new Error('crontab ID not found.')
  schedule.data._id = schedule._id
  let TickEvent = null
  let corn = {
    ID: opt.id,
    IsStoped: true,
    data: schedule.data,
    OnJob: null
  }

  if (opt.tick instanceof Function) {
    TickEvent = async OnJob => Raven.Tracking(async () => {
      if (corn.IsStoped) {
        try {
          await logger.start(`TaskId: '${corn.ID}' started.`)
          corn.IsStoped = false
          await opt.tick()
          corn.IsStoped = true
          await logger.success(`TaskId: '${corn.ID}' successful and next at ${moment(OnJob.nextDates()).format('DD MMMM YYYY HH:mm:ss')}.`)
        } catch (ex) {
          corn.IsStoped = true
          await logger.error(`TaskId: '${corn.ID}' error.`)
          await logger.error(ex)
        }
      }
    })
  } else {
    throw new Error('crontab not tick function or promise.')
  }
  corn.OnJob = new cron.CronJob({
    cronTime: corn.data.time,
    onTick: () => TickEvent(corn.OnJob),
    start: true,
    timeZone: 'Asia/Bangkok'
  })
  await logger.info(`TaskId: '${corn.ID}' is next at ${moment(corn.OnJob.nextDates()).format('DD MMMM YYYY HH:mm:ss')}`)

  if (corn.data.initial) corn.OnJob.fireOnTick()
  await db.Touno.updateOne({ _id: schedule._id }, { $set: { 'data.started': true, 'data.reload': false } })
  core.push(corn)
  if (core.length === 1) {
    let { data } = await db.Touno.findOne({ group: 'config', item: 'server' })
    await RefreshCrontab(db, data['crontab-watch-frequency'])
  }
})
