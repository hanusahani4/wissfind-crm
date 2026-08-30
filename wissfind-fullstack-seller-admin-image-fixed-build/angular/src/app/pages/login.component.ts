import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  standalone:true,
  imports:[FormsModule,NgIf,RouterLink],
  template:`
  <main class="auth-page"><div class="auth-card card">
    <div class="eyebrow">Welcome back</div><h1>Sign in</h1><p class="muted">Use your phone number and password.</p>
    <form (ngSubmit)="submit()">
      <div class="field"><label>Phone number</label><input name="phone" [(ngModel)]="phone" required autocomplete="tel" placeholder="+91 98765 43210"></div>
      <div class="field"><label>Password</label><input type="password" name="password" [(ngModel)]="password" required autocomplete="current-password"></div>
      <p class="error" *ngIf="error">{{error}}</p>
      <button class="btn" [disabled]="loading">{{loading ? 'Signing in…' : 'Sign in'}}</button>
    </form>
    <p class="forgot"><a routerLink="/forgot-password">Forgot password?</a></p><p class="switch">New here? <a routerLink="/signup">Create an account</a></p>
  </div></main>`,
  styles:[`.auth-page{min-height:70vh;display:grid;place-items:center;padding:50px 16px}.auth-card{width:min(430px,100%);padding:32px}.auth-card h1{margin:10px 0 8px}.auth-card form{display:grid;gap:16px;margin-top:26px}.forgot{text-align:right;margin:-7px 0 0;font-size:12px}.forgot a{font-weight:800;color:#111}.switch{text-align:center;color:#777;font-size:13px}.switch a{color:#111;font-weight:800}.auth-card .btn{width:100%;margin-top:4px}`]
})
export class LoginComponent {
  private auth=inject(AuthService); private router=inject(Router); private route=inject(ActivatedRoute);
  phone=''; password=''; loading=false; error='';
  async submit(){
    this.loading=true; this.error='';
    const {error}=await this.auth.signIn(this.phone,this.password);
    this.loading=false;
    if(error){this.error=error.message;return;}
    const role = this.auth.getRole();
    if (role === 'ADMIN') { await this.router.navigateByUrl('/admin'); return; }
    if (role === 'SELLER') { await this.router.navigateByUrl('/seller'); return; }

    const requestedUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    const safeReturnUrl = requestedUrl && requestedUrl.startsWith('/') && !requestedUrl.startsWith('//')
      ? requestedUrl
      : '/';

    // Never bounce a customer back into an authentication page.
    const returnUrl = ['/login', '/signup', '/forgot-password'].some(path =>
      safeReturnUrl === path || safeReturnUrl.startsWith(path + '?')
    ) ? '/' : safeReturnUrl;

    await this.router.navigateByUrl(returnUrl);

  }
}