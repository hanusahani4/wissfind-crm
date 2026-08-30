import { CommonModule } from '@angular/common';
import { Component, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { BackendApiService } from '../core/backend-api.service';

interface SellerApplication {
  id: string;
  userId: string;
  name: string;
  phone: string;
  email: string;
  storeName: string;
  category: string;
  businessType: string;
  pan: string;
  gstin: string;
  pickupAddress: string;
  city: string;
  state: string;
  pincode: string;
  bankAccount: string;
  ifsc: string;
  submittedAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

@Component({
  selector: 'app-seller-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
  <main class="seller-register">
    <div class="register-wrap">
      <div class="intro">
        <a routerLink="/" class="brand">WISS<span>FIND</span></a>
        <p class="eyebrow">SELL ON WISSFIND</p>
        <h1>Turn your products into a growing business.</h1>
        <p class="lead">Create your seller application. Our marketplace team will verify your business and approve your store before you can start selling.</p>
        <div class="steps">
          <div><b>01</b><span>Register your business</span></div>
          <div><b>02</b><span>Submit KYC & bank details</span></div>
          <div><b>03</b><span>Admin verification</span></div>
          <div><b>04</b><span>Start selling</span></div>
        </div>
      </div>

      <section class="card">
        <div class="card-head">
          <div>
            <p class="eyebrow">SELLER ONBOARDING</p>
            <h2>{{ submitted ? 'Application submitted' : 'Create seller account' }}</h2>
          </div>
          <span *ngIf="submitted" class="status pending">Pending review</span>
        </div>

        <ng-container *ngIf="submitted; else form">
          <div class="success">
            <div class="success-icon">✓</div>
            <h3>Application received</h3>
            <p>Your seller application <strong>{{ application?.id }}</strong> has been submitted for admin verification.</p>
            <div class="summary">
              <div><small>Store</small><strong>{{ application?.storeName }}</strong></div>
              <div><small>Category</small><strong>{{ application?.category }}</strong></div>
              <div><small>Status</small><strong>Pending approval</strong></div>
            </div>
            <p class="muted">You will be able to access the Seller Center after the marketplace admin approves your application.</p>
            <div class="actions"><a routerLink="/" class="secondary">Back to shopping</a><button class="primary" (click)="loadExisting()">View application</button></div>
          </div>
        </ng-container>

        <ng-template #form>
          <div *ngIf="error" class="error">{{ error }}</div>
          <form (ngSubmit)="submit()" #sellerForm="ngForm">
            <h3>Business details</h3>
            <div class="grid">
              <label>Owner name<input name="name" [(ngModel)]="formData.name" required placeholder="Full name"></label>
              <label>Phone<input name="phone" [(ngModel)]="formData.phone" required placeholder="+91 98XXXXXXXX"></label>
              <label>Email<input name="email" [(ngModel)]="formData.email" type="email" required placeholder="business@example.com"></label>
              <label>Store name<input name="storeName" [(ngModel)]="formData.storeName" required placeholder="Your Store"></label>
              <label>Category<select name="category" [(ngModel)]="formData.category" required><option value="">Select category</option><option *ngFor="let c of categories" [value]="c">{{ c }}</option></select></label>
              <label>Business type<select name="businessType" [(ngModel)]="formData.businessType" required><option value="">Select type</option><option *ngFor="let b of businessTypes" [value]="b">{{ b }}</option></select></label>
            </div>

            <h3>KYC details</h3>
            <div class="grid">
              <label>PAN<input name="pan" [(ngModel)]="formData.pan" required maxlength="10" placeholder="ABCDE1234F"></label>
              <label>GSTIN <span class="optional">Optional</span><input name="gstin" [(ngModel)]="formData.gstin" maxlength="15" placeholder="22ABCDE1234F1Z5"></label>
            </div>

            <h3>Pickup address</h3>
            <div class="grid">
              <label class="full">Address<input name="pickupAddress" [(ngModel)]="formData.pickupAddress" required placeholder="Pickup / warehouse address"></label>
              <label>City<input name="city" [(ngModel)]="formData.city" required></label>
              <label>State<input name="state" [(ngModel)]="formData.state" required></label>
              <label>PIN code<input name="pincode" [(ngModel)]="formData.pincode" required maxlength="6"></label>
            </div>

            <h3>Bank details</h3>
            <div class="grid">
              <label>Bank account number<input name="bankAccount" [(ngModel)]="formData.bankAccount" required></label>
              <label>IFSC<input name="ifsc" [(ngModel)]="formData.ifsc" required maxlength="11" placeholder="SBIN0001234"></label>
            </div>

            <label class="agree"><input type="checkbox" name="terms" [(ngModel)]="terms"> I confirm that the information provided is accurate and I agree to the seller terms.</label>
            <button class="primary submit" type="submit" [disabled]="!sellerForm.valid || !terms">Submit seller application →</button>
            <p class="muted center">Already a seller? <a routerLink="/login">Login</a></p>
          </form>
        </ng-template>
      </section>
    </div>
  </main>
  `,
  styles: [`
    .seller-register{min-height:calc(100vh - 72px);background:#f7f7f5;padding:48px 20px}.register-wrap{max-width:1180px;margin:auto;display:grid;grid-template-columns:.8fr 1.2fr;gap:48px;align-items:start}.intro{padding:28px 0}.brand{font:700 22px "Space Grotesk",sans-serif}.brand span{font-weight:500}.eyebrow{font-size:11px;letter-spacing:.15em;font-weight:800;margin:42px 0 10px}.intro h1{font:700 48px/1.03 "Space Grotesk",sans-serif;letter-spacing:-.05em;margin:0 0 18px}.lead{font-size:16px;line-height:1.65;color:#666;max-width:500px}.steps{margin-top:38px;display:grid;gap:14px}.steps div{display:flex;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid #ddd}.steps b{font-size:11px;color:#777}.steps span{font-weight:700}.card{background:#fff;border:1px solid #e4e4e0;border-radius:20px;padding:28px;box-shadow:0 15px 50px rgba(0,0,0,.05)}.card-head{display:flex;justify-content:space-between;gap:15px;align-items:start;border-bottom:1px solid #eee;padding-bottom:20px;margin-bottom:24px}.card-head .eyebrow{margin:0 0 5px}.card h2{margin:0;font:700 28px "Space Grotesk",sans-serif}.card h3{font-size:15px;margin:25px 0 13px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.grid label{display:grid;gap:7px;font-size:12px;font-weight:700}.grid .full{grid-column:1/-1}.optional{font-weight:400;color:#999}.grid input,.grid select{width:100%;box-sizing:border-box;border:1px solid #ddd;border-radius:10px;padding:12px;background:#fff;font:inherit;font-weight:400;outline:none}.grid input:focus,.grid select:focus{border-color:#111}.agree{display:flex;gap:9px;align-items:flex-start;margin:22px 0;font-size:12px;color:#555}.agree input{margin-top:2px}.primary,.secondary{border:0;border-radius:10px;padding:12px 16px;font-weight:800;cursor:pointer}.primary{background:#111;color:#fff}.primary:disabled{opacity:.4;cursor:not-allowed}.secondary{background:#f1f1ef;color:#111;text-decoration:none}.submit{width:100%;padding:14px}.center{text-align:center}.muted{color:#777;font-size:12px;line-height:1.5}.status{padding:6px 10px;border-radius:999px;font-size:11px;font-weight:800}.pending{background:#fff3d5;color:#8b5d00}.error{background:#fff0f0;color:#b42318;padding:12px;border-radius:10px;margin-bottom:15px;font-size:13px}.success{text-align:center;padding:20px 10px}.success-icon{width:54px;height:54px;border-radius:50%;background:#e8f7ee;color:#18864b;display:grid;place-items:center;font-size:26px;font-weight:800;margin:10px auto 18px}.success h3{font-size:22px}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:25px 0;text-align:left}.summary div{background:#f7f7f5;padding:14px;border-radius:10px}.summary small,.summary strong{display:block}.summary small{color:#777;font-size:11px;margin-bottom:5px}.summary strong{font-size:13px}.actions{display:flex;gap:10px;justify-content:center;margin-top:24px}@media(max-width:850px){.register-wrap{grid-template-columns:1fr;gap:15px}.intro h1{font-size:38px}.intro{padding:0}.intro .eyebrow{margin-top:20px}}@media(max-width:560px){.grid,.summary{grid-template-columns:1fr}.grid .full{grid-column:auto}.card{padding:20px}}
  `]
})
export class SellerRegisterComponent implements OnDestroy {
  categories = ['Fashion','Electronics','Home & Living','Beauty','Sports & Fitness','Books & Stationery','Grocery','Travel'];
  businessTypes = ['Individual / Proprietorship','Partnership','Private Limited','LLP','Company','Other'];
  terms = false;
  submitted = false;
  error = '';
  application: SellerApplication | null = null;
  formData: Omit<SellerApplication,'id'|'userId'|'submittedAt'|'status'> = {
    name:'',phone:'',email:'',storeName:'',category:'',businessType:'',pan:'',gstin:'',
    pickupAddress:'',city:'',state:'',pincode:'',bankAccount:'',ifsc:''
  };

  private readonly pageAbort = new AbortController();

  constructor(private auth: AuthService, private router: Router, private api: BackendApiService) { this.loadExisting(); }

  ngOnDestroy() { this.pageAbort.abort(); }

  async loadExisting() {
    const user = this.auth.user();
    if (!user) return;
    try {
      const found:any = await this.api.get('/sellers/applications/me', this.pageAbort.signal);
      if (found) { this.application = {...found, id: found.id?.toString(), userId: user.id, submittedAt: found.createdAt}; this.submitted = true; }
    } catch {}
  }

  async submit() {
    this.error = '';
    const user = this.auth.user();
    if (!user) { await this.router.navigate(['/login'], {queryParams:{returnUrl:'/seller/register'}}); return; }
    if (!this.terms) { this.error = 'Please accept the seller terms.'; return; }
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(this.formData.pan)) { this.error = 'Please enter a valid PAN.'; return; }
    if (!/^[0-9]{6}$/.test(this.formData.pincode)) { this.error = 'Please enter a valid 6-digit PIN code.'; return; }
    try {
      const created:any = await this.api.post('/sellers/applications', {ownerName:this.formData.name, phone:this.formData.phone, email:this.formData.email, storeName:this.formData.storeName, category:this.formData.category, businessType:this.formData.businessType, pan:this.formData.pan.toUpperCase(), gstin:this.formData.gstin?.toUpperCase(), pickupAddress:this.formData.pickupAddress, city:this.formData.city, state:this.formData.state, pincode:this.formData.pincode, bankAccount:this.formData.bankAccount, ifsc:this.formData.ifsc.toUpperCase()}, this.pageAbort.signal);
      this.application = {...created, id:String(created.id), userId:user.id, submittedAt:created.createdAt};
      this.submitted = true;
    } catch (e:any) { this.error = e?.error?.error || e?.message || 'Unable to submit seller application.'; }
  }

}
