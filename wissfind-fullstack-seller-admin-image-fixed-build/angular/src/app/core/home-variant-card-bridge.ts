export class HomeVariantCardBridge {
  private static installed = false;
  private static pending = new Set<string>();

  static install(): void {
    if (this.installed || typeof window === 'undefined' || typeof document === 'undefined') return;
    this.installed = true;
    const run = () => this.decorateCards();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
    else run();
    const observer = new MutationObserver(() => {
      window.setTimeout(() => this.decorateCards(), 60);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  private static decorateCards(): void {
    if (location.pathname !== '/') return;
    document.querySelectorAll('.product-card').forEach(card => {
      const article = card as HTMLElement;
      if (article.dataset['variantCardDecorated'] === '1') return;
      const link = article.querySelector('.image-wrap') as HTMLAnchorElement | null;
      const image = link?.querySelector('img') as HTMLImageElement | null;
      if (!link || !image) return;
      const productId = this.productIdFromHref(link.href);
      if (!productId || this.pending.has(productId)) return;
      this.pending.add(productId);
      void this.applyVariant(article, productId).finally(() => this.pending.delete(productId));
    });
  }

  private static async applyVariant(card: HTMLElement, productId: string): Promise<void> {
    try {
      const variants = await this.getVariants(productId);
      if (!variants.length) {
        card.dataset['variantCardDecorated'] = '1';
        return;
      }

      const normalized = variants.map((v: any) => ({
        color: String(v?.color ?? v?.name ?? '').trim(),
        images: Array.isArray(v?.images) ? v.images.map((x: any) => String(x ?? '')).filter(Boolean) : [],
        sizes: Array.isArray(v?.sizes) ? v.sizes.map((s: any) => ({
          size: String(s?.size ?? s?.name ?? '').trim(),
          sku: String(s?.sku ?? '').trim(),
          price: Number(s?.price ?? 0),
          oldPrice: Number(s?.oldPrice ?? s?.mrp ?? 0),
          stock: Math.max(0, Number(s?.stock ?? 0))
        })).filter((s: any) => s.size) : []
      })).filter((v: any) => v.color && v.sizes.length);
      if (!normalized.length) return;

      // Home page must never present an unavailable variant. Prefer the current
      // image only when that color still has stock; otherwise use the first color
      // variant that has at least one size with stock > 0.
      const currentImage = (card.querySelector('.image-wrap img') as HTMLImageElement)?.currentSrc || (card.querySelector('.image-wrap img') as HTMLImageElement)?.src || '';
      const currentImageVariant = this.findByImage(normalized, currentImage);
      const selected = (currentImageVariant && this.hasAvailableStock(currentImageVariant))
        ? currentImageVariant
        : normalized.find((v: any) => this.hasAvailableStock(v));

      if (!selected) {
        // All variants are out of stock. Keep the parent product card in its
        // normal out-of-stock state rather than showing an arbitrary variant.
        card.dataset['variantCardDecorated'] = '1';
        return;
      }

      const selectedSize = selected.sizes.find((s: any) => s.stock > 0);
      if (!selectedSize) return;

      // Parent product stock for a variant product is the total of every size
      // stock across every color. The backend persists the same total when
      // variants are saved; this keeps the home card consistent with that value.
      const totalStock = normalized.reduce(
        (colorTotal: number, variant: any) => colorTotal + variant.sizes.reduce(
          (sizeTotal: number, size: any) => sizeTotal + Math.max(0, Number(size.stock || 0)), 0
        ), 0
      );
      card.dataset['variantTotalStock'] = String(totalStock);

      const image = card.querySelector('.image-wrap img') as HTMLImageElement | null;
      if (image && selected.images[0]) image.src = this.absoluteUrl(selected.images[0]);

      const price = card.querySelector('.price strong') as HTMLElement | null;
      const oldPrice = card.querySelector('.price del') as HTMLElement | null;
      if (price) price.textContent = `₹${selectedSize.price.toLocaleString('en-IN')}`;
      if (oldPrice) {
        if (selectedSize.oldPrice > selectedSize.price) {
          oldPrice.textContent = `₹${selectedSize.oldPrice.toLocaleString('en-IN')}`;
          oldPrice.style.display = '';
        } else {
          oldPrice.style.display = 'none';
        }
      } else if (selectedSize.oldPrice > selectedSize.price) {
        const priceBox = card.querySelector('.price') as HTMLElement | null;
        if (priceBox) {
          const del = document.createElement('del');
          del.textContent = `₹${selectedSize.oldPrice.toLocaleString('en-IN')}`;
          priceBox.appendChild(del);
        }
      }

      const sale = card.querySelector('.sale') as HTMLElement | null;
      if (selectedSize.oldPrice > selectedSize.price) {
        if (sale) sale.textContent = 'SALE';
        else {
          const wrap = card.querySelector('.image-wrap');
          if (wrap) {
            const badge = document.createElement('span');
            badge.className = 'sale';
            badge.textContent = 'SALE';
            wrap.appendChild(badge);
          }
        }
      }

      const meta = card.querySelector('.meta') as HTMLElement | null;
      if (meta) {
        const existing = meta.querySelector('.variant-summary') as HTMLElement | null;
        if (existing) existing.remove();
        const summary = document.createElement('span');
        summary.className = 'variant-summary';
        summary.textContent = `${selected.color} · ${selectedSize.size}`;
        summary.title = `Shown variant: ${selected.color}, ${selectedSize.size}, SKU ${selectedSize.sku || '—'}, total stock ${totalStock}`;
        summary.style.cssText = 'font-size:10px;text-transform:none;letter-spacing:0;color:#666;font-weight:700;margin-left:8px;white-space:nowrap;';
        meta.insertBefore(summary, meta.querySelector('.card-rating'));
      }

      const link = card.querySelector('.image-wrap') as HTMLAnchorElement | null;
      if (link) {
        link.dataset['variantColor'] = selected.color;
        link.dataset['variantSize'] = selectedSize.size;
        link.dataset['variantImage'] = this.absoluteUrl(selected.images[0] || currentImage);
      }

      // Angular initially enables/disables this button from parent p.stock. Make
      // the UI reflect the variant total immediately after the variant API loads.
      const addCart = card.querySelector('.add-cart') as HTMLButtonElement | null;
      if (addCart) {
        addCart.disabled = totalStock <= 0;
        addCart.textContent = totalStock > 0 ? 'Add to cart' : 'Out of stock';
        addCart.dataset['variantTotalStock'] = String(totalStock);
      }

      card.dataset['variantCardDecorated'] = '1';
    } catch {
      card.dataset['variantCardDecorated'] = '1';
    }
  }

  private static hasAvailableStock(variant: any): boolean {
    return Array.isArray(variant?.sizes) && variant.sizes.some((s: any) => Number(s?.stock ?? 0) > 0);
  }

  private static findByImage(variants: any[], image: string): any | null {
    const wanted = this.imageKey(image);
    return variants.find((v: any) => v.images.some((x: string) => this.imageKey(x) === wanted)) || null;
  }

  private static async getVariants(productId: string): Promise<any[]> {
    const response = await fetch(`${this.baseUrl()}/products/${encodeURIComponent(productId)}/variants`, { headers: this.authHeaders() });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : (Array.isArray(data?.content) ? data.content : (Array.isArray(data?.variants) ? data.variants : []));
  }

  private static productIdFromHref(href: string): string {
    try {
      const url = new URL(href, window.location.origin);
      const match = url.pathname.match(/^\/product\/([^/?#]+)/);
      return match ? decodeURIComponent(match[1]) : '';
    } catch { return ''; }
  }

  private static imageKey(value: string): string {
    try { return new URL(value, window.location.origin).pathname.replace(/\/+$/, '').toLowerCase(); }
    catch { return value.split('?')[0].replace(/\/+$/, '').toLowerCase(); }
  }

  private static absoluteUrl(url: string): string {
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    return `${this.baseUrl().replace(/\/api$/, '')}/${url.replace(/^\/+/, '')}`;
  }

  private static authHeaders(): Record<string, string> {
    const token = localStorage.getItem('wissfind_jwt');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private static baseUrl(): string {
    return typeof window !== 'undefined' && window.location.hostname === 'localhost' && window.location.port === '4200' ? 'http://localhost:8080/api' : '/api';
  }
}
