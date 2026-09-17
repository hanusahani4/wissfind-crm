export class OrderVariantDomBridge {
  private static installed = false;
  private static observer?: MutationObserver;

  static install(): void {
    if (this.installed || typeof document === 'undefined') return;
    this.installed = true;

    const apply = () => this.apply();

    if (document.body) {
      apply();
      this.observe();
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        apply();
        this.observe();
      }, { once: true });
    }
  }

  private static observe(): void {
    if (this.observer || !document.body) return;

    this.observer = new MutationObserver(() => {
      if (!this.isOrdersPage()) return;
      this.apply();
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  private static isOrdersPage(): boolean {
    return /\/orders(?:\/|$)/.test(window.location.pathname);
  }

  private static apply(): void {
    if (!this.isOrdersPage()) return;

    document.querySelectorAll<HTMLElement>('.orders-page .product-info p').forEach((node) => {
      const raw = node.textContent?.trim() || '';
      if (!raw || node.dataset.variantFormatted === '1') return;

      const match = raw.match(/^(.*?)(?:\s*·\s*Qty\s+)(\d+)$/i);
      if (!match) return;

      const variantText = match[1].trim();
      const quantity = Math.max(1, Number(match[2] || 1));
      const details = this.parseVariant(variantText);

      node.textContent = this.format(details, quantity);
      node.dataset.variantFormatted = '1';
      node.classList.add('order-variant-summary');
    });
  }

  private static parseVariant(value: string): { color?: string; size?: string } {
    const text = value.trim();
    if (!text || text === 'Standard variant') return {};

    // Current backend snapshot format: {color=Red, size=L, sku=..., image=, stock=...}
    const color = text.match(/(?:^|[,{]\s*)color\s*=\s*([^,}]+)/i)?.[1]?.trim();
    const size = text.match(/(?:^|[,{]\s*)size\s*=\s*([^,}]+)/i)?.[1]?.trim();
    if (color || size) return { color, size };

    // Also support a JSON variant snapshot if the backend is changed later.
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object') {
        return {
          color: String(parsed.color ?? '').trim() || undefined,
          size: String(parsed.size ?? '').trim() || undefined
        };
      }
    } catch {
      // Keep the UI stable for an unknown legacy format.
    }

    return {};
  }

  private static format(details: { color?: string; size?: string }, quantity: number): string {
    const parts: string[] = [];
    if (details.color) parts.push(`Color: ${details.color}`);
    if (details.size) parts.push(`Size: ${details.size}`);
    parts.push(`Qty ${quantity}`);
    return parts.join(' · ');
  }
}
