type VariantSize = { size: string; sku: string; price: number; oldPrice: number; stock: number };
type VariantColor = { color: string; images: string[]; sizes: VariantSize[] };

export class SellerVariantDomBridge {
  private static installed = false;
  private static observer?: MutationObserver;
  private static timer?: number;

  static install(): void {
    if (this.installed || typeof window === 'undefined' || typeof document === 'undefined') return;
    this.installed = true;
    const start = () => {
      this.mountIfSellerProducts();
      this.observer = new MutationObserver(() => {
        window.clearTimeout(this.timer);
        this.timer = window.setTimeout(() => this.mountIfSellerProducts(), 80);
      });
      this.observer.observe(document.body, { childList: true, subtree: true });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
  }

  private static mountIfSellerProducts(): void {
    if (!location.pathname.startsWith('/seller')) return;
    const form = document.querySelector('.panel.form form') as HTMLFormElement | null;
    if (!form || form.dataset['variantBridgeMounted'] === '1') return;

    form.dataset['variantBridgeMounted'] = '1';
    document.querySelectorAll('.panel.form label').forEach(label => {
      const text = (label.textContent || '').trim();
      if (text.startsWith('Colors (comma separated)') || text.startsWith('Sizes (comma separated)')) {
        (label as HTMLElement).style.display = 'none';
      }
    });

    const section = document.createElement('section');
    section.className = 'seller-variant-bridge';
    section.innerHTML = this.template();
    const fileLabel = form.querySelector('.file-label');
    if (fileLabel) fileLabel.insertAdjacentElement('afterend', section);
    else form.insertBefore(section, form.lastElementChild);

    this.bind(section, form);
  }

  private static template(): string {
    return `
      <style>
        .seller-variant-bridge{margin:18px 0;border:1px solid #e2e5e9;border-radius:14px;padding:16px;background:#fafaf8;display:block}
        .seller-variant-bridge *{box-sizing:border-box}
        .sv-head,.sv-color-head,.sv-image-head,.sv-size-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
        .sv-head h3{margin:0 0 5px;font-size:18px}.sv-head p{margin:0;color:#777;font-size:12px}
        .sv-head button,.sv-save{background:#111;color:#fff;border:0;border-radius:9px;padding:10px 13px;cursor:pointer;font-weight:700}
        .sv-head button:disabled,.sv-save:disabled{opacity:.5;cursor:not-allowed}
        .sv-color{margin-top:14px;background:#fff;border:1px solid #e1e4e8;border-radius:12px;padding:14px}
        .sv-color-head{padding-bottom:12px;border-bottom:1px solid #eee}.sv-color-head label{display:grid;gap:6px;font-size:12px;font-weight:700;max-width:360px;width:100%}
        .sv-color input,.sv-size input{border:1px solid #d9dde5;border-radius:8px;padding:9px;font:inherit;font-weight:400;min-width:0;background:#fff}
        .sv-remove-color,.sv-remove-size,.sv-remove-image{border:0;background:transparent;color:#b42318;cursor:pointer}
        .sv-image-head{margin-top:14px}.sv-upload{border:1px solid #d9dde5;background:#fff;border-radius:999px;padding:8px 12px;font-size:12px;font-weight:700;cursor:pointer}.sv-upload input{display:none}
        .sv-images{display:flex;gap:9px;flex-wrap:wrap;margin-top:10px}.sv-existing-images,.sv-new-images{display:contents}
        .sv-image{position:relative}.sv-image img{width:82px;height:82px;object-fit:cover;border-radius:9px;border:1px solid #e5e7eb}.sv-image small{position:absolute;left:5px;bottom:5px;background:#111;color:#fff;border-radius:5px;padding:2px 5px;font-size:8px}
        .sv-image button{position:absolute;right:3px;top:3px;width:21px;height:21px;border:0;border-radius:50%;background:#111;color:#fff;cursor:pointer}
        .sv-size-head{margin-top:16px}.sv-add-size{border:0;background:transparent;text-decoration:underline;cursor:pointer}.sv-sizes{margin-top:9px;overflow:auto}
        .sv-size{display:grid;grid-template-columns:1fr 1.5fr 100px 100px 90px 28px;gap:7px;align-items:center;margin-bottom:7px;min-width:680px}.sv-empty{padding:14px;border:1px dashed #d5d8dd;border-radius:9px;color:#888;font-size:12px;text-align:center;margin-top:14px}
        .sv-actions{display:flex;justify-content:flex-end;align-items:center;gap:12px;margin-top:14px}.sv-status{font-size:12px;color:#667085}
        @media(max-width:700px){.sv-head{align-items:flex-start;flex-direction:column}.sv-size{min-width:620px}.seller-variant-bridge{padding:12px}}
      </style>
      <div class="sv-head">
        <div><h3>Product variants</h3><p>Set color-specific images and size-level SKU, price, MRP and stock.</p></div>
        <button type="button" class="sv-add-color">+ Add color</button>
      </div>
      <div class="sv-list"></div>
      <div class="sv-empty">No colors added yet. Click <b>+ Add color</b>.</div>
      <div class="sv-actions"><button type="button" class="sv-save">Save variants</button><span class="sv-status"></span></div>`;
  }

  private static bind(section: HTMLElement, form: HTMLFormElement): void {
    const list = section.querySelector('.sv-list') as HTMLElement;
    const empty = section.querySelector('.sv-empty') as HTMLElement;
    const status = section.querySelector('.sv-status') as HTMLElement;
    const saveButton = section.querySelector('.sv-save') as HTMLButtonElement;
    const addColorButton = section.querySelector('.sv-add-color') as HTMLButtonElement;

    addColorButton.addEventListener('click', () => {
      list.appendChild(this.colorCard());
      empty.style.display = list.children.length ? 'none' : '';
    });

    list.addEventListener('click', event => {
      const target = event.target as HTMLElement;
      const card = target.closest('.sv-color') as HTMLElement | null;
      if (!card) return;
      if (target.classList.contains('sv-remove-color')) {
        card.remove();
        empty.style.display = list.children.length ? 'none' : '';
      }
      if (target.classList.contains('sv-add-size')) card.querySelector('.sv-sizes')?.appendChild(this.sizeRow());
      if (target.classList.contains('sv-remove-size')) target.closest('.sv-size')?.remove();
      if (target.classList.contains('sv-remove-image')) target.closest('.sv-image')?.remove();
    });

    list.addEventListener('change', event => {
      const input = event.target as HTMLInputElement;
      if (!input.classList.contains('sv-files')) return;
      const gallery = input.closest('.sv-color')?.querySelector('.sv-new-images') as HTMLElement | null;
      if (!gallery) return;
      for (const file of Array.from(input.files || [])) {
        if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
          status.textContent = `${file.name} must be an image no larger than 5 MB.`;
          continue;
        }
        const item = document.createElement('div');
        item.className = 'sv-image sv-new-image';
        item.dataset['fileKey'] = `${file.name}_${file.size}_${file.lastModified}`;
        item.innerHTML = `<img><button type="button" class="sv-remove-image">×</button><small>NEW</small>`;
        const img = item.querySelector('img') as HTMLImageElement;
        img.src = URL.createObjectURL(file);
        item.dataset['fileName'] = file.name;
        item.dataset['fileSize'] = String(file.size);
        item.dataset['fileLastModified'] = String(file.lastModified);
        (item as any).__file = file;
        gallery.appendChild(item);
      }
      input.value = '';
    });

    saveButton.addEventListener('click', async () => {
      status.textContent = 'Saving variants...';
      saveButton.disabled = true;
      try {
        const productId = await this.resolveProductId(form);
        if (!productId) throw new Error('Save the product first, then save its variants.');
        const variants = this.readVariants(list);
        this.validate(variants);
        const saved = await this.api(`/products/${productId}/variants`, 'PUT', variants);
        const savedList = Array.isArray(saved) ? saved : [];
        const cards = Array.from(list.querySelectorAll('.sv-color')) as HTMLElement[];
        for (let i = 0; i < cards.length; i++) {
          const files = Array.from(cards[i].querySelectorAll('.sv-new-image')).map(x => (x as any).__file).filter(Boolean) as File[];
          if (!files.length) continue;
          const colorName = variants[i].color.toLowerCase();
          const match = savedList.find((x: any) => String(x.color || '').trim().toLowerCase() === colorName);
          if (!match?.id) continue;
          const fd = new FormData();
          files.forEach(file => fd.append('files', file, file.name));
          await this.api(`/products/${productId}/variants/${match.id}/images`, 'POST', fd, true);
        }
        status.textContent = 'Variants saved successfully.';
        await this.loadInto(list, productId);
      } catch (e: any) {
        status.textContent = e?.message || 'Unable to save variants.';
      } finally {
        saveButton.disabled = false;
      }
    });

    void this.resolveProductId(form).then(id => id && this.loadInto(list, id).catch(() => undefined));
  }

  private static colorCard(color: VariantColor = { color: '', images: [], sizes: [{ size: '', sku: '', price: 0, oldPrice: 0, stock: 0 }] }): HTMLElement {
    const card = document.createElement('div');
    card.className = 'sv-color';
    card.innerHTML = `
      <div class="sv-color-head"><label>Color*<input class="sv-color-name" value="${this.escape(color.color)}" placeholder="Black"></label><button type="button" class="sv-remove-color">Remove</button></div>
      <div class="sv-image-head"><b>Color images</b><label class="sv-upload">+ Images<input class="sv-files" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple></label></div>
      <div class="sv-images"><div class="sv-existing-images"></div><div class="sv-new-images"></div></div>
      <div class="sv-size-head"><b>Sizes</b><button type="button" class="sv-add-size">+ Add size</button></div>
      <div class="sv-sizes"></div>`;
    const sizes = card.querySelector('.sv-sizes') as HTMLElement;
    for (const size of color.sizes?.length ? color.sizes : [{ size: '', sku: '', price: 0, oldPrice: 0, stock: 0 }]) sizes.appendChild(this.sizeRow(size));
    const existing = card.querySelector('.sv-existing-images') as HTMLElement;
    for (const image of color.images || []) this.imageItem(existing, image, false);
    return card;
  }

  private static sizeRow(size: VariantSize = { size: '', sku: '', price: 0, oldPrice: 0, stock: 0 }): HTMLElement {
    const row = document.createElement('div');
    row.className = 'sv-size';
    row.innerHTML = `<input class="sv-size-name" placeholder="M" value="${this.escape(size.size)}"><input class="sv-size-sku" placeholder="SKU-BLK-M" value="${this.escape(size.sku)}"><input class="sv-size-price" type="number" min="1" value="${Number(size.price) || 0}"><input class="sv-size-mrp" type="number" min="0" value="${Number(size.oldPrice) || 0}"><input class="sv-size-stock" type="number" min="0" value="${Number(size.stock) || 0}"><button type="button" class="sv-remove-size">×</button>`;
    return row;
  }

  private static imageItem(parent: HTMLElement, image: string, removable: boolean): void {
    const item = document.createElement('div');
    item.className = 'sv-image';
    item.innerHTML = `<img src="${this.escapeAttr(image)}">${removable ? '<button type="button" class="sv-remove-image">×</button>' : ''}`;
    parent.appendChild(item);
  }

  private static readVariants(list: HTMLElement): VariantColor[] {
    return Array.from(list.querySelectorAll('.sv-color')).map(card => ({
      color: (card.querySelector('.sv-color-name') as HTMLInputElement)?.value.trim() || '',
      images: Array.from(card.querySelectorAll('.sv-existing-images img')).map(x => (x as HTMLImageElement).src),
      sizes: Array.from(card.querySelectorAll('.sv-size')).map(row => ({
        size: (row.querySelector('.sv-size-name') as HTMLInputElement)?.value.trim() || '',
        sku: (row.querySelector('.sv-size-sku') as HTMLInputElement)?.value.trim() || '',
        price: Number((row.querySelector('.sv-size-price') as HTMLInputElement)?.value || 0),
        oldPrice: Number((row.querySelector('.sv-size-mrp') as HTMLInputElement)?.value || 0),
        stock: Math.max(0, Number((row.querySelector('.sv-size-stock') as HTMLInputElement)?.value || 0))
      }))
    }));
  }

  private static validate(variants: VariantColor[]): void {
    if (!variants.length) throw new Error('Add at least one color variant.');
    const seen = new Set<string>();
    for (const variant of variants) {
      const key = variant.color.toLowerCase();
      if (!variant.color) throw new Error('Every variant needs a color.');
      if (seen.has(key)) throw new Error(`Duplicate color: ${variant.color}`);
      seen.add(key);
      if (!variant.sizes.length) throw new Error(`Add at least one size for ${variant.color}.`);
      for (const size of variant.sizes) {
        if (!size.size || !size.sku || size.price <= 0) throw new Error(`Size, SKU and price are required for ${variant.color}.`);
      }
    }
  }

  private static async resolveProductId(form: HTMLFormElement): Promise<string> {
    const sku = (form.querySelector('input[name="sku"]') as HTMLInputElement | null)?.value.trim();
    if (!sku) return '';
    const data: any = await this.api(`/seller/paged/products?page=0&size=50&search=${encodeURIComponent(sku)}`, 'GET');
    const products = data?.content || [];
    const match = products.find((p: any) => String(p.sku || '').trim().toLowerCase() === sku.toLowerCase());
    return match?.id ? String(match.id) : '';
  }

  private static async loadInto(list: HTMLElement, productId: string): Promise<void> {
    const data = await this.api(`/products/${productId}/variants`, 'GET');
    const variants = Array.isArray(data) ? data : [];
    list.innerHTML = '';
    for (const variant of variants) list.appendChild(this.colorCard({ color: String(variant.color || ''), images: Array.isArray(variant.images) ? variant.images : [], sizes: Array.isArray(variant.sizes) ? variant.sizes.map((x: any) => ({ size: String(x.size || ''), sku: String(x.sku || ''), price: Number(x.price || 0), oldPrice: Number(x.oldPrice || 0), stock: Number(x.stock || 0) })) : [] }));
    const empty = list.parentElement?.querySelector('.sv-empty') as HTMLElement | null;
    if (empty) empty.style.display = variants.length ? 'none' : '';
  }

  private static async api(path: string, method: string, body?: any, multipart = false): Promise<any> {
    const headers: Record<string, string> = {};
    const token = localStorage.getItem('wissfind_jwt');
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${this.baseUrl()}${path}`, {
      method,
      headers: multipart ? headers : { ...headers, 'Content-Type': 'application/json' },
      body: method === 'GET' ? undefined : (multipart ? body : JSON.stringify(body))
    });
    const text = await response.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!response.ok) throw new Error(data?.error || data?.message || `Request failed (${response.status})`);
    return data;
  }

  private static baseUrl(): string {
    return typeof window !== 'undefined' && window.location.hostname === 'localhost' && window.location.port === '4200' ? 'http://localhost:8080/api' : '/api';
  }

  private static escape(value: string): string { return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  private static escapeAttr(value: string): string { return this.escape(value).replace(/'/g, '&#39;'); }
}