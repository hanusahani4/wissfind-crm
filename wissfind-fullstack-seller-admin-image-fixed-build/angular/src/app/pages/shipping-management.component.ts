import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BackendApiService } from '../core/backend-api.service';

@Component({
  standalone: true,
  imports: [NgIf, FormsModule, RouterLink],
  template: `
    <main class="page"><div class="container wrap">
      <div class="top"><div><div class="eyebrow">Admin settings</div><h1>Delivery & COD</h1><p class="muted">Control free delivery, shipping charges and the maximum order value allowed for COD.</p></div><a routerLink="/admin" class="back">← Admin Panel</a></div>

      <div class="card" *ngIf="!loading">
        <div class="grid">
          <label>Free delivery above / at
            <div class="input"><span>₹</span><input type="number" min="0" step="1" [(ngModel)]="form.freeShippingThreshold"></div>
            <small>Orders at or above this product amount get free delivery for COD and prepaid.</small>
          </label>
          <label>Prepaid shipping charge
            <div class="input"><span>₹</span><input type="number" min="0" step="1" [(ngModel)]="form.prepaidShippingCharge"></div>
            <small>Charge when the order is below the free-delivery threshold and payment is online.</small>
          </label>
          <label>COD shipping charge
            <div class="input"><span>₹</span><input type="number" min="0" step="1" [(ngModel)]="form.codShippingCharge"></div>
            <small>Charge when the order is below the free-delivery threshold and payment is COD.</small>
          </label>
          <label>Maximum COD order value
            <div class="input"><span>₹</span><input type="number" min="0" step="1" [(ngModel)]="form.codMaxOrderAmount"></div>
            <small>Above this amount, COD is unavailable and checkout requires prepaid payment.</small>
          </label>
        </div>

        <label class="toggle"><input type="checkbox" [(ngModel)]="form.codEnabled"><span><b>Enable Cash on Delivery</b><small>Turn this off to make every order prepaid.</small></span></label>

        <div class="preview">
          <strong>Current rule</strong>
          <span>₹{{form.freeShippingThreshold || 0}}+ → <b>FREE delivery</b></span>
          <span>Below that → ₹{{form.prepaidShippingCharge || 0}} prepaid / ₹{{form.codShippingCharge || 0}} COD</span>
          <span>COD above ₹{{form.codMaxOrderAmount || 0}} → <b>Prepaid required</b></span>
        </div>

        <p class="error" *ngIf="error">{{error}}</p>
        <p class="success" *ngIf="saved">✓ Shipping settings saved.</p>
        <button class="btn" [disabled]="saving" (click)="save()">{{saving ? 'Saving…' : 'Save delivery settings'}}</button>
      </div>
      <div class="card loading" *ngIf="loading">Loading delivery settings…</div>
    </div></main>
  `,
  styles: [`
    .wrap{padding:42px 0 80px;max-width:980px}.top{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;margin-bottom:24px}.top h1{margin:8px 0}.back{border:1px solid var(--line);border-radius:999px;padding:10px 14px;font-size:13px;font-weight:700;white-space:nowrap}.card{padding:28px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}label{display:grid;gap:7px;font-size:13px;font-weight:700}.input{display:flex;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#fff}.input span{padding:12px 0 12px 13px;color:#777}.input input{width:100%;border:0;outline:0;padding:12px;background:transparent;font:inherit}.grid small,.toggle small{font-size:11px;color:#777;font-weight:400;line-height:1.4}.toggle{margin-top:24px;display:flex;grid-template-columns:none;flex-direction:row;align-items:flex-start;gap:10px;border:1px solid var(--line);border-radius:11px;padding:14px;background:#fafafa}.toggle input{margin-top:3px;accent-color:#111}.toggle span{display:grid;gap:4px}.preview{display:grid;gap:7px;margin:24px 0;padding:16px;border-radius:11px;background:#f7f7f5;font-size:13px}.preview strong{font-size:12px;text-transform:uppercase;letter-spacing:.08em}.error{color:#b42318;font-size:13px}.success{color:#19744a;font-size:13px;font-weight:700}.btn{border:0;background:#111;color:#fff;border-radius:9px;padding:12px 18px;font-weight:800;cursor:pointer}.btn:disabled{opacity:.55;cursor:not-allowed}.loading{text-align:center}@media(max-width:700px){.wrap{padding:25px 0}.top{flex-direction:column}.grid{grid-template-columns:1fr}.card{padding:20px}}
  `]
})
export class ShippingManagementComponent implements OnInit {
  private readonly api = inject(BackendApiService);
  private readonly cdr = inject(ChangeDetectorRef);
  loading = true;
  saving = false;
  saved = false;
  error = '';
  form = {
    freeShippingThreshold: 200,
    prepaidShippingCharge: 20,
    codShippingCharge: 70,
    codMaxOrderAmount: 2000,
    codEnabled: true
  };

  async ngOnInit() {
    try {
      const value: any = await this.api.get('/shipping-config');
      this.form = {
        freeShippingThreshold: Number(value?.freeShippingThreshold ?? 200),
        prepaidShippingCharge: Number(value?.prepaidShippingCharge ?? 20),
        codShippingCharge: Number(value?.codShippingCharge ?? 70),
        codMaxOrderAmount: Number(value?.codMaxOrderAmount ?? 2000),
        codEnabled: value?.codEnabled !== false
      };
    } catch (e: any) {
      this.error = e?.error?.error || e?.message || 'Unable to load delivery settings.';
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async save() {
    this.error = '';
    this.saved = false;
    const values = [this.form.freeShippingThreshold, this.form.prepaidShippingCharge, this.form.codShippingCharge, this.form.codMaxOrderAmount];
    if (values.some(v => !Number.isFinite(Number(v)) || Number(v) < 0)) {
      this.error = 'All amounts must be zero or greater.';
      return;
    }
    this.saving = true;
    this.cdr.markForCheck();
    try {
      const saved: any = await this.api.put('/shipping-config', {
        ...this.form,
        freeShippingThreshold: Number(this.form.freeShippingThreshold),
        prepaidShippingCharge: Number(this.form.prepaidShippingCharge),
        codShippingCharge: Number(this.form.codShippingCharge),
        codMaxOrderAmount: Number(this.form.codMaxOrderAmount)
      });
      this.form = {
        freeShippingThreshold: Number(saved.freeShippingThreshold),
        prepaidShippingCharge: Number(saved.prepaidShippingCharge),
        codShippingCharge: Number(saved.codShippingCharge),
        codMaxOrderAmount: Number(saved.codMaxOrderAmount),
        codEnabled: saved.codEnabled !== false
      };
      this.saved = true;
    } catch (e: any) {
      this.error = e?.error?.error || e?.message || 'Unable to save delivery settings.';
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }
}
