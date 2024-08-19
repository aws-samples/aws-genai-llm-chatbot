export const minuteExp = `(0?[0-9]|[1-5][0-9])`; // [0]0-59
export const hourExp = `(0?[0-9]|1[0-9]|2[0-3])`; // [0]0-23
export const dayOfMonthExp = `(0?[1-9]|[1-2][0-9]|3[0-1])`; // [0]1-31
export const monthExp = `(0?[1-9]|1[0-2]|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)`; // [0]1-12 or JAN-DEC
export const dayOfWeekExp = `([1-7]|SUN|MON|TUE|WED|THU|FRI|SAT)`; // 1-7 or SAT-SUN
export const yearExp = `((19[8-9][0-9])|(2[0-1][0-9][0-9]))`; // 1980-2199
export const numbers = `([0-9]*[1-9][0-9]*)`; // whole numbers greater than 0

export function dayOfWeekHash(): string {
  return `(${dayOfWeekExp}#[1-5])`; // add hash expression to enable supported use case
}

function rangeRegex(values: string): string {
  return `(${values}|(\\*\\-${values})|(${values}\\-${values})|(${values}\\-\\*))`;
}

function listRangeRegex(values: string): string {
  const range = rangeRegex(values);
  return `(${range}(\\,${range})*)`;
}

function slashRegex(values: string): string {
  const range = rangeRegex(values);
  return `((\\*|${range}|${values})\\/${numbers})`;
}

function listSlashRegex(values: string): string {
  const slash = slashRegex(values);
  const slashOrRange = `(${slash}|${rangeRegex(values)})`;
  return `(${slashOrRange}(\\,${slashOrRange})*)`;
}

function commonRegex(values: string): string {
  return `(${listRangeRegex(values)}|\\*|${listSlashRegex(values)})`;
}

export function minuteRegex(): string {
  return `^(${commonRegex(minuteExp)})$`;
}

export function hourRegex(): string {
  return `^(${commonRegex(hourExp)})$`;
}

export function dayOfMonthRegex(): string {
  return `^(${commonRegex(dayOfMonthExp)}|\\?|L|LW|${dayOfMonthExp}W)$`;
}

export function monthRegex(): string {
  return `^(${commonRegex(monthExp)})$`;
}

export function dayOfWeekRegex(): string {
  const rangeList = listRangeRegex(dayOfWeekExp);
  return `^(${rangeList}|\\*|\\?|${dayOfWeekExp}L|L|L-[1-7]|${dayOfWeekHash()})$`;
}

export function yearRegex(): string {
  return `^(${commonRegex(yearExp)})$`;
}
