/** Query-edge scales. The model and the wire keep dollars. D1 keeps integers.
 * numeric(12,2) money is cents. numeric(12,4) rates and qty are ten thousandths.
 * numeric(9,6) share is millionths. */

export function cents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function dollars(cents: number): number {
  return cents / 100;
}

export function tenThousandths(n: number): number {
  return Math.round(n * 10000);
}

export function fromTenThousandths(n: number): number {
  return n / 10000;
}

export function millionths(n: number): number {
  return Math.round(n * 1000000);
}

export function fromMillionths(n: number): number {
  return n / 1000000;
}

export function centsOrNull(n: number | null | undefined): number | null {
  return n == null ? null : cents(n);
}

export function dollarsOrNull(n: number | null | undefined): number | null {
  return n == null ? null : dollars(n);
}
