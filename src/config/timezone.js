const moment = require('moment-timezone');
const { logger } = require('../utils/logger');

const applyDefaultTimezone = () => {
  const tz = process.env.TZ;
  if (!tz) {
    return;
  }

  try {
    process.env.TZ = tz;
    moment.tz.setDefault(tz);
    logger.info(`应用默认时区: ${tz}`);
  } catch (error) {
    logger.error('应用默认时区失败:', error);
  }
};

module.exports = { applyDefaultTimezone };
