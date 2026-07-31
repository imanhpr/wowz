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

export function formatGold(value: number): string {
  return goldFormatter.format(Math.round(value))
}

export function formatTokenDate(value: string): string {
  return dateFormatter.format(new Date(value))
}

export function formatChartDate(value: string): string {
  return shortDateFormatter.format(new Date(value))
}
