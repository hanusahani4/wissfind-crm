export class SellerVariantHelpBridge {
  private static installed = false;
  private static observer?: MutationObserver;

  static install(): void {
    if (this.installed || typeof window === 'undefined' || typeof document === 'undefined') return;
    this.installed = true;
    const apply = () => this.apply();
    apply();
    this.observer = new MutationObserver(apply);
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  private static apply(): void {
    if (!location.pathname.startsWith('/seller')) return;
    const section = document.querySelector('.seller-variant-bridge') as HTMLElement | null;
    if (!section || section.querySelector('.sv-field-guide')) return;

    const head = section.querySelector('.sv-head');
    const guide = document.createElement('div');
    guide.className = 'sv-field-guide';
    guide.innerHTML = `
      <style>
        .sv-field-guide{margin:12px 0 2px;padding:11px 12px;border-radius:10px;background:#f4f5f7;border:1px solid #e5e7eb;font-size:12px;line-height:1.55;color:#555}
        .sv-field-guide strong{color:#111}.sv-field-guide-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px 18px;margin-top:5px}
        .sv-field-guide code{font-family:inherit;background:#fff;border:1px solid #e5e7eb;border-radius:4px;padding:1px 4px;color:#111}
        @media(max-width:700px){.sv-field-guide-grid{grid-template-columns:1fr}}
      </style>
      <strong>What to enter?</strong>
      <div class="sv-field-guide-grid">
        <span><b>Color:</b> e.g. Black, Red, Blue</span>
        <span><b>Color images:</b> upload only images of that color</span>
        <span><b>Size:</b> e.g. S, M, L, XL</span>
        <span><b>SKU:</b> unique code, e.g. <code>TSH-BLK-M</code></span>
        <span><b>Price:</b> customer selling price, e.g. 499</span>
        <span><b>MRP:</b> original/list price, e.g. 699</span>
        <span><b>Stock:</b> available quantity, e.g. 20</span>
        <span><b>Parent images:</b> common product images shown on listing/home</span>
      </div>`;
    if (head) head.insertAdjacentElement('afterend', guide);

    section.querySelectorAll<HTMLInputElement>('.sv-color-name').forEach(x => x.title = 'Color name, e.g. Black');
    section.querySelectorAll<HTMLInputElement>('.sv-size-name').forEach(x => x.title = 'Size, e.g. M or XL');
    section.querySelectorAll<HTMLInputElement>('.sv-size-sku').forEach(x => x.title = 'Unique SKU for this color + size');
    section.querySelectorAll<HTMLInputElement>('.sv-size-price').forEach(x => x.title = 'Selling price customer pays');
    section.querySelectorAll<HTMLInputElement>('.sv-size-mrp').forEach(x => x.title = 'Original/list price (MRP)');
    section.querySelectorAll<HTMLInputElement>('.sv-size-stock').forEach(x => x.title = 'Available stock quantity');
  }
}
