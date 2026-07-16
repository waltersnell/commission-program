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
  return new Date(`${value}T00:00:00`);
}

export function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function monthKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
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
