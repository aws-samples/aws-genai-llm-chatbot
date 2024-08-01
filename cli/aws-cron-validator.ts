class AWSCronError extends Error {}

import {
  minuteRegex,
  hourRegex,
  dayOfMonthRegex,
  monthRegex,
  dayOfWeekRegex,
  yearRegex,
} from "./aws-cron-expressions";

export class AWSCronValidator {
  public static validate(expression: string): string {
    if (!expression.trim()) {
      throw new AWSCronError(
        `No parameters entered, this format is required in UTC: 0 20 ? * SUN-FRI *`
      );
    }
    const valueCount = expression.split(" ").length;
    if (valueCount !== 6) {
      throw new AWSCronError(
        `Incorrect amount of parameters in '${expression}'. 6 required, ${valueCount} provided.`
      );
    }

    const [minute, hour, dayOfMonth, month, dayOfWeek, year] =
      expression.split(" ");

    // special handling for Day of Month and Day of Week
    if (
      !(
        (dayOfMonth === "?" && dayOfWeek !== "?") ||
        (dayOfMonth !== "?" && dayOfWeek === "?")
      )
    ) {
      throw new AWSCronError(
        `Invalid combination of day-of-month '${dayOfMonth}' and day-of-week '${dayOfWeek}'. One must be a question mark (?)`
      );
    }

    if (!new RegExp(minuteRegex()).test(minute)) {
      throw new AWSCronError(`Invalid minute value '${minute}'.`);
    }
    if (!new RegExp(hourRegex()).test(hour)) {
      throw new AWSCronError(`Invalid hour value '${hour}'.`);
    }
    if (!new RegExp(dayOfMonthRegex()).test(dayOfMonth)) {
      throw new AWSCronError(`Invalid day-of-month value '${dayOfMonth}'.`);
    }
    if (!new RegExp(monthRegex(), "i").test(month)) {
      throw new AWSCronError(`Invalid month value '${month}'.`);
    }
    if (!new RegExp(dayOfWeekRegex(), "i").test(dayOfWeek)) {
      throw new AWSCronError(`Invalid day-of-week value '${dayOfWeek}'.`);
    }
    if (!new RegExp(yearRegex()).test(year)) {
      throw new AWSCronError(`Invalid year value '${year}'.`);
    }

    return expression;
  }
}
