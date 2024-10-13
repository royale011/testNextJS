import * as winston from "winston";
import { format } from "date-fns";
import Transport from "winston-transport";

// Create a custom Winston transport for Sentry
class SentryTransport extends Transport {
  log(info: any, callback: any) {
    if (info.level === "error") {
    }

    // Make sure to execute interior Winston callback
    callback();
  }
}

const logger = winston.createLogger({
  // Set the log level
  level: "debug",
  format: winston.format.combine(
    // [%lvl%]   [%time%]   [%traceID%]   [%spanID%]   [%caller%]   -   %msg%
    winston.format.printf((info) => {
      const timestamp = format(new Date(), "yyyy-MM-dd HH:mm:ss");
      return `[${info.level}]   [${timestamp}]   -   ${info.message}`;
    }),
  ),
  transports: [new winston.transports.Console(), new SentryTransport()],
});

export default logger;
