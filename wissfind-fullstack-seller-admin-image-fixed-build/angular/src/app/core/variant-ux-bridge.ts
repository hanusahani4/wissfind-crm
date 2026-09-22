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
      this.installRelatedProductUx();
      const observer = new MutationObserver(() => {
        window.clearTimeout(this.timer);
        this.timer = window.setTimeout(() => {
          this.installSellerUx();
          this.installDetailVariantSelection();
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
    section.querySelector('.sv-head')?.insertAdjacentElement('afterend', addHint);
    const normalize = () => {
      section.querySelectorAll('.sv-size').forEach(row => {
        const size = row.querySelector('.sv-size-name') as HTMLInputElement | null;
        const sku = row.querySelector('.sv-size-sku') as HTMLInputElement | null;
        const price = row.querySelector('.sv-size-price') as HTMLInputElement | null;
        const mrp = row.querySelector('.sv-size-mrp') as HTMLInputElement | null;
        const stock = row.querySelector('.sv-size-stock') as HTMLInputElement | null;
        if (!size || !sku || !price || !mrp || !stock) return;
        price.placeholder = 'Selling price (₹)'; mrp.placeholder = 'MRP (₹)'; stock.placeholder = 'Stock qty';
        size.title = 'Size, e.g. S, M, L, XL'; sku.title = 'Unique SKU, e.g. TSH-BLK-M';
        price.title = 'Customer selling price'; mrp.title = 'Original/list price'; stock.title = 'Available quantity';
        if (price.value === '0' && mrp.value === '0') { price.value = ''; mrp.value = ''; if (stock.value === '0') stock.value = ''; }
      });
      const colors = section.querySelector('.sv-list') as HTMLElement | null;
      const save = section.querySelector('.sv-save') as HTMLButtonElement | null;
      if (save && colors) { const hasColor = !!colors.querySelector('.sv-color'); save.disabled = !hasColor; save.title = hasColor ? 'Save product variants' : 'No variants added. Use the normal product fields above.'; }
    };
    normalize();
    const observer = new MutationObserver(normalize);
    observer.observe(section, { childList: true, subtree: true });
  }

  private static installHomeVariantNavigation(): void {
    // Let Angular RouterLink perform the navigation. The home card now passes
    // the already-loaded product through router state, so detail can render
    // immediately without a full-page reload or an extra wait.
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

  private static installRelatedProductUx(): void {
    if (!location.pathname.startsWith('/product/')) return;
    // Related cards use Angular RouterLink + router state now. Avoid intercepting
    // the click and forcing a full browser navigation, which was causing a slow
    // reload before the next product detail page appeared.
    if (document.head && !document.getElementById('related-product-ux-fix')) {
      const style = document.createElement('style');
      style.id = 'related-product-ux-fix';
      style.textContent = `.related-products-section{width:100%;box-sizing:border-box;overflow:visible}.related-grid{width:100%;box-sizing:border-box}.related-card{display:block;width:100%;box-sizing:border-box;cursor:pointer}.related-image{width:100%;aspect-ratio:1/1;height:auto;min-height:0}.related-image img{width:100%;height:100%;object-fit:cover;display:block}@media(max-width:600px){.related-products-section{margin-top:48px;padding-top:30px}.related-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:18px 12px}.related-image{aspect-ratio:1/1;height:auto;border-radius:14px}.related-card h3{font-size:14px;line-height:1.3;min-height:36px}.related-meta{margin-top:9px;font-size:9px}.related-price strong{font-size:14px}.related-price del{font-size:10px}.related-like{width:32px;height:32px;right:8px;top:8px}.sale-badge{top:8px;left:8px;padding:6px 8px;font-size:9px}}`;
      document.head.appendChild(style);
    }
  }

  private static async getVariants(productId: string): Promise<any[]> {
    const response = await fetch(`${this.baseUrl()}/products/${encodeURIComponent(productId)}/variants`, { headers: this.authHeaders() });
    if (!response.ok) throw new Error(`Variants request failed (${response.status})`);
    const data = await response.json();
    return Array.isArray(data) ? data : (Array.isArray(data?.content) ? data.content : (Array.isArray(data?.variants) ? data.variants : []));
  }
  private static findAvailableVariantByImage(variants: any[], image: string): { color?: string; size?: string; image?: string } | null {
    const wanted = this.imageKey(image);
    for (const variant of variants) {
      const sizes = Array.isArray(variant?.sizes) ? variant.sizes : [];
      const available = sizes.find((s: any) => Number(s?.stock ?? 0) > 0);
      if (!available) continue;
      const images = Array.isArray(variant?.images) ? variant.images.map((x: any) => String(x || '')).filter(Boolean) : [];
      if (!images.some((candidate: string) => this.imageKey(candidate) === wanted)) continue;
      return { color: String(variant?.color ?? variant?.name ?? '').trim() || undefined, size: String(available?.size ?? available?.name ?? '').trim() || undefined, image: images[0] || undefined };
    }
    return null;
  }
  private static findFirstAvailableVariant(variants: any[]): { color?: string; size?: string; image?: string } | null {
    for (const variant of variants) {
      const sizes = Array.isArray(variant?.sizes) ? variant.sizes : [];
      const available = sizes.find((s: any) => Number(s?.stock ?? 0) > 0);
      if (!available) continue;
      const images = Array.isArray(variant?.images) ? variant.images.map((x: any) => String(x || '')).filter(Boolean) : [];
      return { color: String(variant?.color ?? variant?.name ?? '').trim() || undefined, size: String(available?.size ?? available?.name ?? '').trim() || undefined, image: images[0] || undefined };
    }
    return null;
  }
  private static imageKey(value: string): string { try { const url = new URL(value, window.location.origin); return url.pathname.replace(/\/+$/, '').toLowerCase(); } catch { return value.split('?')[0].replace(/\/+$/, '').toLowerCase(); } }
  private static productIdFromHref(href: string): string { try { const url = new URL(href, window.location.origin); const match = url.pathname.match(/^\/product\/([^/?#]+)/); return match ? decodeURIComponent(match[1]) : ''; } catch { return ''; } }
  private static authHeaders(): Record<string, string> { const token = localStorage.getItem('wissfind_jwt'); return token ? { Authorization: `Bearer ${token}` } : {}; }
  private static baseUrl(): string { return typeof window !== 'undefined' && window.location.hostname === 'localhost' && window.location.port === '4200' ? 'http://localhost:8080/api' : '/api'; }
}
