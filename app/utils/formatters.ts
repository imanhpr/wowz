const goldFormatter = new Intl.NumberFormat('fa-IR', {
  maximumFractionDigits: 0,
})

const dateFormatter = new Intl.DateTimeFormat('fa-IR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Tehran',
})

const shortDateFormatter = new Intl.DateTimeFormat('fa-IR', {
  month: 'short',
  day: 'numeric',
  timeZone: 'Asia/Tehran',
})

const shortDateTimeFormatter = new Intl.DateTimeFormat('fa-IR', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Tehran',
})

const percentChangeFormatter = new Intl.NumberFormat('fa-IR', {
  style: 'percent',
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
})

const relativeTimeFormatter = new Intl.RelativeTimeFormat('fa-IR', {
  numeric: 'auto',
})

export function formatGold(value: number): string {
  return goldFormatter.format(Math.round(value))
}

export function formatTokenDate(value: string): string {
  return dateFormatter.format(new Date(value))
}

export function formatRelativeTime(value: string, now = Date.now()): string {
  const differenceInSeconds = (new Date(value).getTime() - now) / 1_000
  const absoluteDifference = Math.abs(differenceInSeconds)

  if (absoluteDifference < 60) {
    return relativeTimeFormatter.format(0, 'second')
  }

  if (absoluteDifference < 3_600) {
    return relativeTimeFormatter.format(Math.trunc(differenceInSeconds / 60), 'minute')
  }

  if (absoluteDifference < 86_400) {
    return relativeTimeFormatter.format(Math.trunc(differenceInSeconds / 3_600), 'hour')
  }

  return relativeTimeFormatter.format(Math.trunc(differenceInSeconds / 86_400), 'day')
}

export function formatChartDate(value: string): string {
  return shortDateFormatter.format(new Date(value))
}

export function formatChartDateTime(value: string): string {
  return shortDateTimeFormatter.format(new Date(value))
}

export function formatPercentChange(value: number): string {
  return percentChangeFormatter.format(value)
}
