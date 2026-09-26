import { CommonModule } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BackendApiService } from '../core/backend-api.service';

@Component({
  standalone: true,
  selector: 'app-product-variants',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="variant-box">
      <div class="variant-head">
        <div>
          <h3>Product variants</h3>
          <p>Choose a color, upload its images, then add the available sizes. Images are shared by all sizes of that color.</p>
        </div>
        <button type="button" class="primary" (click)="addColor()">+ Add color</button>
      </div>

      <div class="color-card" *ngFor="let color of variants; let ci = index">
        <div class="color-head">
          <label>Color* <input [(ngModel)]="color.color" [name]="'color_'+ci" placeholder="Black"></label>
          <button type="button" class="danger" (click)="removeColor(ci)">Remove color</button>
        </div>

        <div class="image-row">
          <div class="image-title"><b>{{color.color || 'Color'}} images</b><small>These images appear when this color is selected.</small></div>
          <label class="upload-btn">+ Images
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple (change)="selectImages($event, ci)">
          </label>
        </div>
        <div class="gallery" *ngIf="(color.images||[]).length || pendingFiles[ci]?.length">
          <div class="gallery-item" *ngFor="let image of color.images; let ii=index">
            <img [src]="image">
            <button type="button" (click)="removeImage(ci,ii)">×</button>
          </div>
          <div class="gallery-item pending" *ngFor="let file of (pendingFiles[ci]||[])" title="New image - save product to upload">
            <img [src]="previewUrl(file)"><span>NEW</span>
          </div>
        </div>

        <div class="size-head"><b>Sizes</b><button type="button" class="link" (click)="addSize(ci)">+ Add size</button></div>
        <div class="size-table">
          <div class="size-row header"><span>Size</span><span>SKU</span><span>Price</span><span>MRP</span><span>Stock</span><span></span></div>
          <div class="size-row" *ngFor="let size of color.sizes; let si=index">
            <input [(ngModel)]="size.size" [name]="'size_'+ci+'_'+si" placeholder="M">
            <input [(ngModel)]="size.sku" [name]="'sku_'+ci+'_'+si" placeholder="ABC-BLK-M">
            <input type="number" min="1" [(ngModel)]="size.price" [name]="'price_'+ci+'_'+si">
            <input type="number" min="0" [(ngModel)]="size.oldPrice" [name]="'mrp_'+ci+'_'+si">
            <input type="number" min="0" [(ngModel)]="size.stock" [name]="'stock_'+ci+'_'+si">
            <button type="button" class="danger" (click)="removeSize(ci,si)">×</button>
          </div>
        </div>
        <div class="empty-size" *ngIf="!(color.sizes||[]).length">Add at least one size for this color.</div>
      </div>

      <p class="error" *ngIf="error">{{error}}</p>
      <div class="variant-actions" *ngIf="variants.length">
        <button type="button" class="primary" [disabled]="saving" (click)="save()">{{saving?'Saving variants...':'Save variants'}}</button>
      </div>
    </div>
  `,
  styles: [`
    .variant-box{margin-top:18px;border:1px solid #e5e7eb;border-radius:14px;padding:16px;background:#fafaf8}.variant-head,.color-head,.image-row,.size-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.variant-head h3{margin:0 0 5px}.variant-head p{margin:0;color:#777;font-size:12px}.color-card{background:#fff;border:1px solid #e1e4e8;border-radius:12px;padding:14px;margin-top:14px}.color-head{padding-bottom:12px;border-bottom:1px solid #eee}.color-head label{display:grid;gap:6px;font-size:12px;font-weight:700;max-width:360px;width:100%}.color-head input,.size-row input{border:1px solid #d9dde5;border-radius:8px;padding:9px;font:inherit;font-weight:400;min-width:0}.primary{background:#111;color:#fff;border:0;border-radius:9px;padding:10px 13px;cursor:pointer}.primary:disabled{opacity:.45}.danger,.link{border:0;background:transparent;cursor:pointer}.danger{color:#b42318}.link{text-decoration:underline}.image-row{margin-top:14px}.image-title{display:grid;gap:3px}.image-title small{color:#777;font-size:11px}.upload-btn{border:1px solid #d9dde5;background:#fff;border-radius:999px;padding:8px 12px;font-size:12px;font-weight:700;cursor:pointer}.upload-btn input{display:none}.gallery{display:flex;gap:9px;flex-wrap:wrap;margin-top:10px}.gallery-item{position:relative}.gallery-item img{width:82px;height:82px;object-fit:cover;border-radius:9px;border:1px solid #e5e7eb}.gallery-item button{position:absolute;right:3px;top:3px;width:21px;height:21px;border:0;border-radius:50%;background:#111;color:#fff;cursor:pointer}.gallery-item.pending{opacity:.75}.gallery-item.pending span{position:absolute;left:5px;bottom:5px;background:#111;color:#fff;border-radius:5px;padding:2px 5px;font-size:8px}.size-head{margin-top:16px}.size-table{margin-top:9px;overflow:auto}.size-row{display:grid;grid-template-columns:1fr 1.5fr 100px 100px 90px 28px;gap:7px;align-items:center;margin-bottom:7px;min-width:680px}.size-row.header{font-size:10px;color:#777;font-weight:700;text-transform:uppercase}.empty-size{padding:12px;border:1px dashed #ddd;border-radius:8px;color:#888;font-size:11px;text-align:center}.variant-actions{display:flex;justify-content:flex-end;margin-top:14px}.error{color:#b42318;background:#fff0f0;padding:9px;border-radius:8px;font-size:12px}
  `]
})
export class ProductVariantsComponent {
  @Input({ required: true }) productId!: number | string;
  private api = inject(BackendApiService);
  variants: any[] = [];
  pendingFiles: Record<number, File[]> = {};
  saving = false;
  error = '';

  async ngOnInit() { await this.load(); }

  async load() {
    try { this.variants = await this.api.get<any[]>(`/products/${this.productId}/variants`) || []; }
    catch { this.variants = []; }
  }

  addColor() { this.variants.push({ color: '', images: [], sizes: [{ size: '', sku: '', price: 0, oldPrice: 0, stock: 0 }] }); }
  removeColor(index: number) { this.variants.splice(index, 1); delete this.pendingFiles[index]; }
  addSize(colorIndex: number) { this.variants[colorIndex].sizes = this.variants[colorIndex].sizes || []; this.variants[colorIndex].sizes.push({ size: '', sku: '', price: 0, oldPrice: 0, stock: 0 }); }
  removeSize(colorIndex: number, sizeIndex: number) { this.variants[colorIndex].sizes.splice(sizeIndex, 1); }

  selectImages(event: Event, colorIndex: number) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    const invalid = files.find(file => !file.type.startsWith('image/') || file.size > 5 * 1024 * 1024);
    if (invalid) { this.error = `${invalid.name} must be an image no larger than 5 MB.`; input.value = ''; return; }
    const existing = this.pendingFiles[colorIndex] || [];
    const merged = [...existing, ...files];
    this.pendingFiles[colorIndex] = merged.filter((file, index, arr) => arr.findIndex(x => x.name === file.name && x.size === file.size) === index);
    input.value = '';
    this.error = '';
  }

  removeImage(colorIndex: number, imageIndex: number) { this.variants[colorIndex].images.splice(imageIndex, 1); }
  previewUrl(file: File) { return URL.createObjectURL(file); }

  async save() {
    this.error = '';
    if (!this.variants.length) { this.error = 'Add at least one color variant.'; return; }
    const seen = new Set<string>();
    for (const color of this.variants) {
      const colorName = String(color.color || '').trim();
      if (!colorName) { this.error = 'Every variant needs a color.'; return; }
      const colorKey = colorName.toLowerCase();
      if (seen.has(colorKey)) { this.error = `Duplicate color: ${colorName}`; return; }
      seen.add(colorKey);
      if (!color.sizes?.length) { this.error = `Add at least one size for ${colorName}.`; return; }
      for (const size of color.sizes) {
        if (!String(size.size || '').trim() || !String(size.sku || '').trim() || Number(size.price) <= 0) {
          this.error = `Size, SKU and price are required for ${colorName}.`; return;
        }
      }
    }

    this.saving = true;
    try {
      const payload = this.variants.map(color => ({
        color: String(color.color).trim(),
        images: (color.images || []).filter(Boolean),
        sizes: (color.sizes || []).map((size: any) => ({
          size: String(size.size).trim(), sku: String(size.sku).trim(), price: Number(size.price), oldPrice: Number(size.oldPrice) || 0, stock: Math.max(0, Number(size.stock) || 0)
        }))
      }));
      const saved = await this.api.put<any[]>(`/products/${this.productId}/variants`, payload);
      for (let i = 0; i < this.variants.length; i++) {
        const files = this.pendingFiles[i] || [];
        const color = this.variants[i];
        const match = (saved || []).find((item: any) => String(item.color).toLowerCase() === String(color.color).trim().toLowerCase());
        if (files.length && match?.id) {
          const fd = new FormData();
          files.forEach(file => fd.append('files', file, file.name));
          await this.api.upload(`/products/${this.productId}/variants/${match.id}/images`, fd);
        }
      }
      this.pendingFiles = {};
      await this.load();
    } catch (e: any) {
      this.error = e?.error?.error || e?.error?.message || e?.message || 'Unable to save variants';
    } finally { this.saving = false; }
  }
}
