type VariantSize = { size: string; sku: string; price: number; oldPrice: number; stock: number };
type VariantColor = { color: string; images: string[]; sizes: VariantSize[] };

export class ProductVariantDomBridge {
  private static installed = false;
  private static observer?: MutationObserver;
  private static timer?: number;
  private static mountedProductId = '';

  static install(): void {
    if (this.installed || typeof window === 'undefined' || typeof document === 'undefined') return;
    this.installed = true;
    const start = () => {
      this.mountIfProductDetail();
      this.observer = new MutationObserver(() => {
        window.clearTimeout(this.timer);
        this.timer = window.setTimeout(() => this.mountIfProductDetail(), 100);
      });
      this.observer.observe(document.body, { childList: true, subtree: true });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
  }

  private static mountIfProductDetail(): void {
    const match = location.pathname.match(/^\/product\/([^/?#]+)/);
    if (!match) {
      this.mountedProductId = '';
      return;
    }

    const productId = decodeURIComponent(match[1]);
    const main = document.querySelector('main.page') as HTMLElement | null;
    const copy = main?.querySelector('.copy') as HTMLElement | null;
    if (!main || !copy) return;
    if (copy.dataset['variantViewMounted'] === productId) return;

    copy.querySelector('.product-variant-view')?.remove();
    copy.querySelectorAll('.option').forEach(x => (x as HTMLElement).style.display = 'none');

    const section = document.createElement('section');
    section.className = 'product-variant-view';
    section.dataset['productId'] = productId;
    section.innerHTML = this.template();

    const addButton = copy.querySelector('.btn.add');
    if (addButton) copy.insertBefore(section, addButton);
    else copy.appendChild(section);

    copy.dataset['variantViewMounted'] = productId;
    this.mountedProductId = productId;
    void this.load(productId, section, main);
  }

  private static template(): string {
    return `<style>
      .product-variant-view{margin:22px 0 16px;padding:16px 0;border-top:1px solid var(--line,#e5e5e5);border-bottom:1px solid var(--line,#e5e5e5)}
      .pvv-block{margin-bottom:17px}.pvv-block:last-child{margin-bottom:0}.pvv-title{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:9px;font-size:14px}.pvv-selected{font-weight:700;color:#555;font-size:12px}
      .pvv-swatches{display:flex;flex-wrap:wrap;gap:9px}.pvv-swatch{border:1px solid #d9d9d9;background:#fff;color:#111;border-radius:9px;padding:9px 13px;cursor:pointer;font:inherit;font-size:13px;transition:.15s}.pvv-swatch:hover{border-color:#111}.pvv-swatch.active{border-color:#111;box-shadow:0 0 0 1px #111;font-weight:800;background:#f7f7f5}.pvv-swatch:focus-visible{outline:2px solid #111;outline-offset:2px}
      .pvv-swatch.out{opacity:.55}.pvv-info{display:flex;flex-wrap:wrap;gap:10px 18px;margin-top:12px;color:#666;font-size:12px}.pvv-info b{color:#111}.pvv-status{font-size:12px;color:#777;margin-top:10px}.pvv-status.error{color:#b42318}.pvv-stock-note{font-size:11px;color:#777;margin-top:7px}
    </style>
    <div class="pvv-block pvv-color-block"><div class="pvv-title"><strong>Color</strong><span class="pvv-selected pvv-color-selected"></span></div><div class="pvv-swatches pvv-colors"></div></div>
    <div class="pvv-block pvv-size-block"><div class="pvv-title"><strong>Size</strong><span class="pvv-selected pvv-size-selected">Select size</span></div><div class="pvv-swatches pvv-sizes"></div><div class="pvv-info"><span>SKU: <b class="pvv-sku">—</b></span><span>Stock: <b class="pvv-stock">—</b></span></div><div class="pvv-stock-note">Choose a size to see its price, SKU and available stock.</div></div>
    <div class="pvv-status"></div>`;
  }

  private static async load(productId: string, section: HTMLElement, main: HTMLElement): Promise<void> {
    try {
      const data = await this.api(`/products/${encodeURIComponent(productId)}/variants`);
      const raw = Array.isArray(data) ? data : (Array.isArray(data?.content) ? data.content : (Array.isArray(data?.variants) ? data.variants : []));
      const variants: VariantColor[] = raw.map((v: any) => ({
        color: String(v?.color ?? v?.name ?? '').trim(),
        images: Array.isArray(v?.images) ? v.images.map((x: any) => this.absoluteUrl(String(x ?? ''))).filter(Boolean) : [],
        sizes: Array.isArray(v?.sizes) ? v.sizes.map((s: any) => ({
          size: String(s?.size ?? s?.name ?? '').trim(),
          sku: String(s?.sku ?? '').trim(),
          price: Number(s?.price ?? 0),
          oldPrice: Number(s?.oldPrice ?? s?.mrp ?? 0),
          stock: Math.max(0, Number(s?.stock ?? 0))
        })).filter((s: VariantSize) => s.size) : []
      })).filter((v: VariantColor) => v.color && v.sizes.length);

      if (!variants.length) {
        section.remove();
        main.querySelectorAll('.copy .option').forEach(x => (x as HTMLElement).style.display = '');
        return;
      }

      const firstColor = variants[0];
      const firstAvailable = firstColor.sizes.find(s => s.stock > 0) || firstColor.sizes[0];
      this.render(section, main, variants, firstColor, firstAvailable);
    } catch {
      const status = section.querySelector('.pvv-status') as HTMLElement | null;
      if (status) {
        status.textContent = 'Variants could not be loaded. Please refresh the page.';
        status.classList.add('error');
      }
    }
  }

  private static render(section: HTMLElement, main: HTMLElement, variants: VariantColor[], selectedColor: VariantColor, selectedSize: VariantSize): void {
    const colors = section.querySelector('.pvv-colors') as HTMLElement;
    const sizes = section.querySelector('.pvv-sizes') as HTMLElement;
    const colorText = section.querySelector('.pvv-color-selected') as HTMLElement;
    const sizeText = section.querySelector('.pvv-size-selected') as HTMLElement;
    const sku = section.querySelector('.pvv-sku') as HTMLElement;
    const stock = section.querySelector('.pvv-stock') as HTMLElement;
    const status = section.querySelector('.pvv-status') as HTMLElement;

    colors.innerHTML = '';
    variants.forEach(variant => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'pvv-swatch';
      button.textContent = variant.color;
      button.setAttribute('aria-pressed', String(variant.color.toLowerCase() === selectedColor.color.toLowerCase()));
      if (variant.color.toLowerCase() === selectedColor.color.toLowerCase()) button.classList.add('active');
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        const nextSize = variant.sizes.find(s => s.stock > 0) || variant.sizes[0];
        this.render(section, main, variants, variant, nextSize);
      });
      colors.appendChild(button);
    });

    sizes.innerHTML = '';
    const safeSize = selectedSize && selectedColor.sizes.some(s => s.sku === selectedSize.sku) ? selectedSize : (selectedColor.sizes.find(s => s.stock > 0) || selectedColor.sizes[0]);
    selectedColor.sizes.forEach(size => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'pvv-swatch';
      button.textContent = size.size;
      button.setAttribute('aria-label', `Select size ${size.size}`);
      button.setAttribute('aria-pressed', String(!!safeSize && size.sku === safeSize.sku));
      if (safeSize && size.sku === safeSize.sku) button.classList.add('active');
      if (size.stock <= 0) {
        button.classList.add('out');
        button.title = 'Out of stock';
      }
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        this.render(section, main, variants, selectedColor, size);
      });
      sizes.appendChild(button);
    });

    colorText.textContent = `Selected: ${selectedColor.color}`;
    sizeText.textContent = safeSize?.size ? `Selected: ${safeSize.size}` : 'Select size';
    sku.textContent = safeSize?.sku || '—';
    stock.textContent = safeSize ? String(safeSize.stock) : '—';

    const price = main.querySelector('.price strong') as HTMLElement | null;
    const oldPrice = main.querySelector('.price del') as HTMLElement | null;
    if (safeSize) {
      if (price) price.textContent = `₹${safeSize.price.toLocaleString('en-IN')}`;
      if (oldPrice) {
        if (safeSize.oldPrice > safeSize.price) {
          oldPrice.textContent = `₹${safeSize.oldPrice.toLocaleString('en-IN')}`;
          oldPrice.style.display = '';
        } else {
          oldPrice.style.display = 'none';
        }
      }
    }

    status.textContent = safeSize && safeSize.stock <= 0 ? 'This size is currently out of stock.' : '';
    status.classList.toggle('error', !!safeSize && safeSize.stock <= 0);
    this.setGallery(main, selectedColor.images);
    this.pauseAuto(main);
  }

  private static setGallery(main: HTMLElement, images: string[]): void {
    if (!images.length) return;
    const thumbs = main.querySelector('.thumbs') as HTMLElement | null;
    const mainImage = main.querySelector('.main-image img') as HTMLImageElement | null;
    const progress = main.querySelector('.slide-progress') as HTMLElement | null;
    const count = main.querySelector('.image-count') as HTMLElement | null;
    if (!thumbs || !mainImage) return;

    thumbs.innerHTML = '';
    images.forEach((image, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `thumb${index === 0 ? ' active' : ''}`;
      button.title = `View image ${index + 1}`;
      const img = document.createElement('img');
      img.src = image;
      img.alt = `Product variant image ${index + 1}`;
      button.appendChild(img);
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        this.selectGalleryImage(main, images, index);
      });
      thumbs.appendChild(button);
    });

    if (progress) progress.innerHTML = images.map((_, i) => `<span class="${i === 0 ? 'active' : ''}"></span>`).join('');
    this.selectGalleryImage(main, images, 0);
    if (count) count.textContent = `1 / ${images.length}`;
  }

  private static selectGalleryImage(main: HTMLElement, images: string[], index: number): void {
    const mainImage = main.querySelector('.main-image img') as HTMLImageElement | null;
    const thumbs = main.querySelectorAll('.thumb');
    const progress = main.querySelectorAll('.slide-progress span');
    if (!mainImage || !images.length) return;
    const safe = Math.max(0, Math.min(index, images.length - 1));
    mainImage.src = images[safe];
    thumbs.forEach((x, i) => x.classList.toggle('active', i === safe));
    progress.forEach((x, i) => x.classList.toggle('active', i === safe));
    const count = main.querySelector('.image-count') as HTMLElement | null;
    if (count) count.textContent = `${safe + 1} / ${images.length}`;
  }

  private static pauseAuto(main: HTMLElement): void {
    const button = main.querySelector('.auto-btn') as HTMLButtonElement | null;
    if (button && button.textContent?.includes('Pause')) button.click();
  }

  private static async api(path: string): Promise<any> {
    const token = localStorage.getItem('wissfind_jwt');
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await fetch(`${this.baseUrl()}${path}`, { headers });
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    return response.json();
  }

  private static baseUrl(): string {
    return typeof window !== 'undefined' && window.location.hostname === 'localhost' && window.location.port === '4200' ? 'http://localhost:8080/api' : '/api';
  }

  private static absoluteUrl(url: string): string {
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith('/')) return `${this.baseUrl().replace(/\/api$/, '')}${url}`;
    return `${this.baseUrl().replace(/\/api$/, '')}/${url}`;
  }
}
