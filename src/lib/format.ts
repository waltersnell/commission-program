export const APP_TIME_ZONE = "America/Los_Angeles";

const pacificDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const normalized = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return {
    normalized,
    display: formatPhone(normalized),
  };
}

export function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 10) {
    return value;
  }
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function toLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function dateInputValue(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function currentDateInputValue(date = new Date()) {
  const { year, month, day } = pacificParts(date);
  return `${year}-${month}-${day}`;
}

export function monthKey(date?: Date) {
  if (!date) {
    return currentMonthKey();
  }
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function currentMonthKey(date = new Date()) {
  const { year, month } = pacificParts(date);
  return `${year}-${month}`;
}

export function monthLabel(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    month: "long",
    year: "numeric",
  }).format(date);
}

export function longDateLabel(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

export function addCalendarDays(date: Date, days: number) {
  const [year, month, day] = dateInputValue(date).split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  const shiftedValue = [
    shifted.getUTCFullYear(),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0"),
  ].join("-");
  return toLocalDate(shiftedValue);
}

export function startOfCalendarDay(date = new Date()) {
  return toLocalDate(dateInputValue(date));
}

export function startOfCurrentCalendarDay(date = new Date()) {
  return toLocalDate(currentDateInputValue(date));
}

export function monthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const start = toLocalDate(`${year}-${String(monthNumber).padStart(2, "0")}-01`);
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;
  const nextYear = monthNumber === 12 ? year + 1 : year;
  const end = toLocalDate(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01`);
  return { start, end };
}

export function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function centsToDollarInput(cents: string | number) {
  const numericCents = typeof cents === "number" ? cents : Number(cents);
  return (Number.isFinite(numericCents) ? numericCents / 100 : 0).toFixed(2);
}

export function dollarInputToCents(value: string) {
  const normalized = value.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }
  return Math.round(Number(normalized) * 100);
}

export function basisPointsToPercentInput(value: string | number) {
  const basisPoints = typeof value === "number" ? value : Number(value);
  return (Number.isFinite(basisPoints) ? basisPoints / 100 : 0).toFixed(2);
}

export function percentInputToBasisPoints(value: string) {
  const normalized = value.replace(/[%\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }
  return Math.round(Number(normalized) * 100);
}

export function formatCreditBasisPoints(basisPoints: number) {
  return trimDecimal((basisPoints / 10000).toFixed(2));
}

export function formatBasisPointsPercent(basisPoints: number) {
  return `${trimDecimal((basisPoints / 100).toFixed(2))}%`;
}

export function basisPointsToDecimalString(basisPoints: number) {
  const whole = Math.trunc(basisPoints / 10000);
  const fraction = String(Math.abs(basisPoints % 10000)).padStart(4, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : `${whole}`;
}

export function displayStatus(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function trimDecimal(value: string) {
  return value.replace(/\.?0+$/, "");
}

function pacificParts(date: Date) {
  const parts = pacificDateTimeFormatter.formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: byType.year,
    month: byType.month,
    day: byType.day,
    hour: byType.hour,
    minute: byType.minute,
    second: byType.second,
  };
}
