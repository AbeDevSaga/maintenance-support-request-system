/**
 * Parse duration string to milliseconds
 * Supports formats like: "15m", "7d", "1h", "30s"
 * 
 * @param {string} duration - Duration string (e.g., "15m", "7d", "1h")
 * @returns {number|null} - Duration in milliseconds, or null if invalid
 */
const parseDuration = (duration) => {
  if (!duration || typeof duration !== 'string') {
    return null;
  }

  const regex = /^(\d+)([smhd])$/;
  const match = duration.toLowerCase().match(regex);

  if (!match) {
    return null;
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's': // seconds
      return value * 1000;
    case 'm': // minutes
      return value * 60 * 1000;
    case 'h': // hours
      return value * 60 * 60 * 1000;
    case 'd': // days
      return value * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
};

/**
 * Default cookie durations
 */
const DEFAULT_COOKIE_DURATIONS = {
  ACCESS_TOKEN: 15 * 60 * 1000, // 15 minutes
  REFRESH_TOKEN: 7 * 24 * 60 * 60 * 1000, // 7 days
};

module.exports = {
  parseDuration,
  DEFAULT_COOKIE_DURATIONS,
};
