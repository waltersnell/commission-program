"use client";

export function PrintButton() {
  return <button className="button-secondary" type="button" onClick={() => window.print()}>Print report</button>;
}
