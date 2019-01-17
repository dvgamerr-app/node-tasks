const { Raven, debuger } = require('@touno-io/debuger')

const logger = debuger.scope('Interval')
module.exports = options => Raven.Tracking(async () => {
  options = Object.assign({ now: false, second: 30, interval: 0 }, options)
  logger.info(`Job Interval started every ${options.second}s.`)

  let iLoop = 0
  let rawIntervel = 0
  const OnTickerEvent = async () => {
    iLoop++
    await Raven.Tracking(options.tick.bind(null, iLoop), true)
    await OnSetTimeoutEvent()
  }
  const OnSetTimeoutEvent = () => {
    clearTimeout(rawIntervel)
    if (options.interval <= iLoop || !options.interval) rawIntervel = setTimeout(() => OnTickerEvent(), options.second * 1000)
  }

  if (options.now) OnTickerEvent(); else OnSetTimeoutEvent()
})
