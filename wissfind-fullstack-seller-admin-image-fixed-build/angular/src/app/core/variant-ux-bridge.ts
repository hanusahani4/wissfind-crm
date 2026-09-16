/**
 * Small compatibility bridge for variant UX that stays outside the large Angular
 * components. It fixes seller placeholders and carries the clicked home-page
 * product image into the product-detail variant selection.
 */
export class VariantUxBridge {
  private static installed = false;
  private static timer?: number;

  static install(): void {
    if (this.installed || typeof window === 'undefined' || typeof document === 'undefined') return;
    this.installed = true;
    const start = () => {
      this.installSellerUx();
      this.installHomeVariantNavigation();
      this.installDetailVariantSelection();
      const observer = new MutationObserver(() => {
        window.clearTimeout(this.timer);
        this.timer = window.setTimeout(() => {
          this.installSellerUx();
          this.installDetailVariantSelection();
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

        // Only blank the untouched default row. A real saved variant with stock 0
        // must remain 0 because zero stock is a valid inventory value.
        const isDefaultRow = !size.value.trim() && !sku.value.trim();
        if (isDefaultRow) {
          if (price.value === '0') price.value = '';
          if (mrp.value === '0') mrp.value = '';
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

  private static installHomeVariantNavigation(): void {
    if (location.pathname !== '/') return;
    if (document.body.dataset['variantHomeNav'] === '1') return;
    document.body.dataset['variantHomeNav'] = '1';

    document.addEventListener('click', async event => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest('.product-card .image-wrap') as HTMLAnchorElement | null;
      if (!link || !link.href) return;

      const productId = this.productIdFromHref(link.href);
      if (!productId) return;
      const image = link.querySelector('img')?.currentSrc || link.querySelector('img')?.src || '';
      if (!image) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      try {
        const variants = await this.getVariants(productId);
        const match = this.findVariantByImage(variants, image);
        const url = new URL(link.href, window.location.origin);
        if (match?.color) url.searchParams.set('variantColor', match.color);
        if (match?.size) url.searchParams.set('variantSize', match.size);
        url.searchParams.set('variantImage', image);
        window.location.assign(url.toString());
      } catch {
        window.location.assign(link.href);
      }
    }, true);
  }

  private static installDetailVariantSelection(): void {
    if (!location.pathname.startsWith('/product/')) return;
    const params = new URLSearchParams(location.search);
    const wantedColor = (params.get('variantColor') || '').trim().toLowerCase();
    const wantedSize = (params.get('variantSize') || '').trim().toLowerCase();
    if (!wantedColor && !wantedSize) return;

    const section = document.querySelector('.product-variant-view') as HTMLElement | null;
    if (!section || section.dataset['autoSelectionDone'] === '1') return;

    const colors = Array.from(section.querySelectorAll('.pvv-colors .pvv-swatch')) as HTMLButtonElement[];
    const colorButton = colors.find(button => button.textContent?.trim().toLowerCase() === wantedColor);
    if (!colorButton) return;

    colorButton.click();
    window.setTimeout(() => {
      const sizes = Array.from(section.querySelectorAll('.pvv-sizes .pvv-swatch')) as HTMLButtonElement[];
      const sizeButton = sizes.find(button => button.textContent?.trim().toLowerCase() === wantedSize);
      if (sizeButton) sizeButton.click();
      section.dataset['autoSelectionDone'] = '1';
    }, 0);
  }

  private static async getVariants(productId: string): Promise<any[]> {
    const response = await fetch(`${this.baseUrl()}/products/${encodeURIComponent(productId)}/variants`, {
      headers: this.authHeaders()
    });
    if (!response.ok) throw new Error(`Variants request failed (${response.status})`);
    const data = await response.json();
    return Array.isArray(data) ? data : (Array.isArray(data?.content) ? data.content : (Array.isArray(data?.variants) ? data.variants : []));
  }

  private static findVariantByImage(variants: any[], image: string): { color?: string; size?: string } | null {
    const wanted = this.imageKey(image);
    for (const variant of variants) {
      const images = Array.isArray(variant?.images) ? variant.images : [];
      if (!images.some((candidate: any) => this.imageKey(String(candidate || '')) === wanted)) continue;
      const sizes = Array.isArray(variant?.sizes) ? variant.sizes : [];
      const available = sizes.find((s: any) => Number(s?.stock ?? 0) > 0) || sizes[0];
      return {
        color: String(variant?.color ?? variant?.name ?? '').trim() || undefined,
        size: String(available?.size ?? available?.name ?? '').trim() || undefined
      };
    }
    return null;
  }

  private static imageKey(value: string): string {
    try {
      const url = new URL(value, window.location.origin);
      return url.pathname.replace(/\/+$/, '').toLowerCase();
    } catch {
      return value.split('?')[0].replace(/\/+$/, '').toLowerCase();
    }
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

  private static authHeaders(): Record<string, string> {
    const token = localStorage.getItem('wissfind_jwt');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private static baseUrl(): string {
    return typeof window !== 'undefined' && window.location.hostname === 'localhost' && window.location.port === '4200'
      ? 'http://localhost:8080/api'
      : '/api';
  }
}
