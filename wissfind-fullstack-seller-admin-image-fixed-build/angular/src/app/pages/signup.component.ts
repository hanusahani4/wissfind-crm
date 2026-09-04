import { Component, inject, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  standalone:true,
  imports:[FormsModule,NgIf,RouterLink],
  template:`
  <main class="auth-page"><div class="auth-card card">
    <ng-container *ngIf="step === 1">
      <div class="eyebrow">Join WissFind</div><h1>Create account</h1>
      <p class="muted">Verify your phone before your WissFind account can be used.</p>
      <form (ngSubmit)="sendOtp()">
        <div class="field"><label>Name</label><input name="name" [(ngModel)]="name" required autocomplete="name" placeholder="Alex Morgan"></div>
        <div class="field"><label>Phone number</label><input name="phone" [(ngModel)]="phone" required autocomplete="tel" placeholder="+91 98765 43210"></div>
        <div class="field"><label>Password</label><input type="password" name="password" [(ngModel)]="password" minlength="8" required autocomplete="new-password" placeholder="Minimum 8 characters"></div>
        <p class="error" *ngIf="error">{{error}}</p><p class="success" *ngIf="message">{{message}}</p>
        <button class="btn" [disabled]="loading">{{loading ? 'Sending OTP…' : 'Send OTP'}}</button>
      </form>
    </ng-container>

    <ng-container *ngIf="step === 2">
      <div class="eyebrow">PHONE VERIFICATION</div><h1>Verify your phone</h1>
      <p class="muted">We sent a verification code to <strong>{{phone}}</strong>.</p>
      <form (ngSubmit)="verifyOtp()">
        <div class="field"><label>6-digit OTP</label><input name="otp" [(ngModel)]="otp" required maxlength="8" inputmode="numeric" autocomplete="one-time-code" placeholder="123456"></div>
        <p class="error" *ngIf="error">{{error}}</p><p class="success" *ngIf="message">{{message}}</p>
        <button class="btn" [disabled]="loading">{{loading ? 'Verifying…' : 'Verify & create account'}}</button>
      </form>
      <div class="otp-actions">
        <button type="button" class="text-btn" [disabled]="loading || resendSeconds > 0" (click)="resendOtp()">{{resendSeconds > 0 ? 'Resend in '+resendSeconds+'s' : 'Resend OTP'}}</button>
        <button type="button" class="text-btn" [disabled]="loading" (click)="changeNumber()">Change number</button>
      </div>
    </ng-container>
    <p class="switch">Already have an account? <a routerLink="/login">Sign in</a></p>
  </div></main>`,
  styles:[`
    .auth-page{min-height:70vh;display:grid;place-items:center;padding:50px 16px}.auth-card{width:min(430px,100%);padding:32px}.auth-card h1{margin:10px 0 8px}.auth-card form{display:grid;gap:16px;margin-top:26px}.field{display:grid;gap:7px}.field label{font-size:12px;font-weight:700}.field input{width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:10px;padding:12px;outline:0}.switch{text-align:center;color:#777;font-size:13px;margin-top:22px}.switch a{color:#111;font-weight:800}.auth-card .btn{width:100%;margin-top:4px}.error{color:#c62828;font-size:12px;margin:0}.success{color:#237a35;background:#eef9ef;padding:10px;border-radius:9px;font-size:12px;margin:0}.otp-actions{display:flex;justify-content:space-between;gap:12px;margin-top:15px}.text-btn{border:0;background:transparent;text-decoration:underline;cursor:pointer;font-size:12px}.text-btn:disabled{opacity:.5;cursor:not-allowed}
  `]
})
export class SignupComponent implements OnDestroy {
  private auth=inject(AuthService); private router=inject(Router);
  step=1; name=''; phone=''; password=''; otp=''; loading=false; error=''; message=''; resendSeconds=0; private resendTimer:any;

  async sendOtp(){
    this.error='';this.message='';
    if(!this.name.trim()){this.error='Please enter your name.';return;}
    if(!this.phone.trim()){this.error='Please enter your phone number.';return;}
    if(this.password.length<8){this.error='Password must be at least 8 characters.';return;}
    this.loading=true;
    try {
      const result=await this.auth.signUp(this.phone,this.password,this.name);
      if(result.error){this.error=result.error.message;return;}
      this.step=2;this.message='OTP sent successfully. Please check your phone.';this.startResendTimer();
    } catch (e:any) {
      this.error=e?.message||'Unable to send OTP. Please try again.';
    } finally {
      this.loading=false;
    }
  }

  async verifyOtp(){
    this.error='';this.message='';
    const token=this.otp.trim();
    if(!/^\d{4,8}$/.test(token)){this.error='Enter the OTP sent to your phone.';return;}
    this.loading=true;
    try {
      const {error}=await this.auth.verifySignupOtp(this.phone,token,this.name.trim(),this.password);
      if(error){this.error=error.message;return;}
      await this.router.navigateByUrl('/');
    } catch (e:any) {
      this.error=e?.message||'OTP verification failed. Please try again.';
    } finally {
      this.loading=false;
    }
  }

  async resendOtp(){
    if(this.resendSeconds>0)return;
    this.error='';this.message='';this.loading=true;
    try {
      const {error}=await this.auth.resendSignupOtp(this.phone,this.password,this.name);
      if(error){this.error=error.message;return;}
      this.message='A new OTP has been sent.';this.startResendTimer();
    } catch (e:any) {
      this.error=e?.message||'Unable to resend OTP. Please try again.';
    } finally {
      this.loading=false;
    }
  }

  changeNumber(){this.step=1;this.otp='';this.error='';this.message='';this.resendSeconds=0;clearInterval(this.resendTimer);}

  ngOnDestroy(){clearInterval(this.resendTimer);}

  private startResendTimer(){
    clearInterval(this.resendTimer);this.resendSeconds=60;
    this.resendTimer=setInterval(()=>{this.resendSeconds--;if(this.resendSeconds<=0)clearInterval(this.resendTimer);},1000);
  }
}
