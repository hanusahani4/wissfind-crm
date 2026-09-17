/**
 * Small compatibility bridge for variant UX that stays outside the large Angular
 * components. It fixes seller placeholders and related-product navigation.
 * Customer product navigation intentionally keeps the parent product state until
 * the shopper explicitly selects a color/size.
 */
export class VariantUxBridge {
  private static installed = false;
  private static timer?: number;

  static install(): void {
    if (this.installed || typeof window === 'undefined' || typeof document === 'undefined') return;
    this.installed = true;
    const start = () => {
      this.installSellerUx();
      // Do not run home-to-variant navigation or URL-based auto-selection.
      // Product detail must initially show the parent product image/price.
      this.installRelatedProductUx();
      const observer = new MutationObserver(() => {
        window.clearTimeout(this.timer);
        this.timer = window.setTimeout(() => {
          this.installSellerUx();
          this.installRelatedProductUx();
        }, 80);
      });
      observer.observe(document.body, { childList: true, subtree: true });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
  }

  private static installSellerUx(): void {
    if (!location.pathname.startsWith('/seller')) return;
    const section = document.querySelector('.seller-variant-bridge') as HTMLElement | null;
    if (!section || section.dataset['uxFixed'] === '1') return;
    section.dataset['uxFixed'] = '1';

    const addHint = document.createElement('div');
    addHint.className = 'sv-no-variant-hint';
    addHint.textContent = 'No variants? Leave this section empty. Use the normal Price, MRP and Stock fields above for a single-SKU product.';
    addHint.style.cssText = 'margin:10px 0 2px;padding:9px 11px;border-radius:8px;background:#f3f4f6;color:#667085;font-size:12px;line-height:1.45;';
    const head = section.querySelector('.sv-head');
    head?.insertAdjacentElement('afterend', addHint);

    const normalize = () => {
      section.querySelectorAll('.sv-size').forEach(row => {
        const size = row.querySelector('.sv-size-name') as HTMLInputElement | null;
        const sku = row.querySelector('.sv-size-sku') as HTMLInputElement | null;
        const price = row.querySelector('.sv-size-price') as HTMLInputElement | null;
        const mrp = row.querySelector('.sv-size-mrp') as HTMLInputElement | null;
        const stock = row.querySelector('.sv-size-stock') as HTMLInputElement | null;
        if (!size || !sku || !price || !mrp || !stock) return;

        price.placeholder = 'Selling price (₹)';
        mrp.placeholder = 'MRP (₹)';
        stock.placeholder = 'Stock qty';
        size.title = 'Size, e.g. S, M, L, XL';
        sku.title = 'Unique SKU, e.g. TSH-BLK-M';
        price.title = 'Customer selling price';
        mrp.title = 'Original/list price';
        stock.title = 'Available quantity';

        const untouchedNumericState = price.value === '0' && mrp.value === '0';
        if (untouchedNumericState) {
          price.value = '';
          mrp.value = '';
          if (stock.value === '0') stock.value = '';
        }
      });

      const colors = section.querySelector('.sv-list') as HTMLElement | null;
      const save = section.querySelector('.sv-save') as HTMLButtonElement | null;
      if (save && colors) {
        const hasColor = !!colors.querySelector('.sv-color');
        save.disabled = !hasColor;
        save.title = hasColor ? 'Save product variants' : 'No variants added. Use the normal product fields above.';
      }
    };

    normalize();
    const observer = new MutationObserver(normalize);
    observer.observe(section, { childList: true, subtree: true });
  }

  private static installRelatedProductUx(): void {
    if (!location.pathname.startsWith('/product/')) return;

    if (document.head && !document.getElementById('related-product-ux-fix')) {
      const style = document.createElement('style');
      style.id = 'related-product-ux-fix';
      style.textContent = `
        .related-products-section{width:100%;box-sizing:border-box;overflow:visible}
        .related-grid{width:100%;box-sizing:border-box}
        .related-card{display:block;width:100%;box-sizing:border-box;cursor:pointer}
        .related-image{width:100%;aspect-ratio:1/1;height:auto;min-height:0}
        .related-image img{width:100%;height:100%;object-fit:cover;display:block}
        @media(max-width:600px){
          .related-products-section{margin-top:48px;padding-top:30px}
          .related-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:18px 12px}
          .related-image{aspect-ratio:1/1;height:auto;border-radius:14px}
          .related-card h3{font-size:14px;line-height:1.3;min-height:36px}
          .related-meta{margin-top:9px;font-size:9px}
          .related-price strong{font-size:14px}
          .related-price del{font-size:10px}
          .related-like{width:32px;height:32px;right:8px;top:8px}
          .sale-badge{top:8px;left:8px;padding:6px 8px;font-size:9px}
        }
      `;
      document.head.appendChild(style);
    }

    if (document.body.dataset['relatedProductNav'] === '1') return;
    document.body.dataset['relatedProductNav'] = '1';

    document.addEventListener('click', event => {
      const target = event.target as HTMLElement | null;
      const card = target?.closest('.related-products-section .related-card') as HTMLAnchorElement | null;
      if (!card) return;
      if ((target as HTMLElement)?.closest('.related-like')) return;

      const productId = this.productIdFromHref(card.href || '');
      if (!productId) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.assign(`/product/${encodeURIComponent(productId)}`);
    }, true);
  }

  private static productIdFromHref(href: string): string {
    try {
      const url = new URL(href, window.location.origin);
      const match = url.pathname.match(/^\/product\/([^/?#]+)/);
      return match ? decodeURIComponent(match[1]) : '';
    } catch {
      return '';
    }
  }
}
