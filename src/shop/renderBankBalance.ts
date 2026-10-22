/** Refresh every bank display after a purchase, reward or completed run. */
export function renderBankBalance(coins: number): void {
  for (const label of document.querySelectorAll<HTMLElement>("[data-bank-coins]")) label.textContent = String(coins);
}
