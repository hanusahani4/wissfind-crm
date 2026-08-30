import { Component, inject } from '@angular/core';
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
      <div class="eyebrow">Join WissFind</div>
      <h1>Create account</h1>
      <p class="muted">Verify your phone before your WissFind account can be used.</p>

      <form (ngSubmit)="sendOtp()">
        <div class="field">
          <label>Name</label>
          <input name="name" [(ngModel)]="name" required autocomplete="name"
                 placeholder="Alex Morgan">
        </div>

        <div class="field">
          <label>Phone number</label>
          <input name="phone" [(ngModel)]="phone" required autocomplete="tel"
                 placeholder="+91 98765 43210">
        </div>

        <div class="field">
          <label>Password</label>
          <input type="password" name="password" [(ngModel)]="password"
                 minlength="8" required autocomplete="new-password"
                 placeholder="Minimum 8 characters">
        </div>

        <p class="error" *ngIf="error">{{error}}</p>
        <p class="success" *ngIf="message">{{message}}</p>

        <button class="btn" [disabled]="loading">
          {{loading ? 'Sending OTP…' : 'Send OTP'}}
        </button>
      </form>
    </ng-container>

    <ng-container *ngIf="step === 2">
      <div class="eyebrow">PHONE VERIFICATION</div>
      <h1>Verify your phone</h1>
      <p class="muted">
        We sent a verification code to <strong>{{phone}}</strong>.
      </p>

      <form (ngSubmit)="verifyOtp()">
        <div class="field">
          <label>6-digit OTP</label>
          <input name="otp" [(ngModel)]="otp" required maxlength="6"
                 inputmode="numeric" autocomplete="one-time-code"
                 placeholder="123456">
        </div>

        <p class="error" *ngIf="error">{{error}}</p>
        <p class="success" *ngIf="message">{{message}}</p>

        <button class="btn" [disabled]="loading">
          {{loading ? 'Verifying…' : 'Verify & create account'}}
        </button>
      </form>

      <div class="otp-actions">
        <button type="button" class="text-btn" [disabled]="loading"
                (click)="resendOtp()">
          Resend OTP
        </button>
        <button type="button" class="text-btn"
                (click)="step=1;error='';message=''">
          Change number
        </button>
      </div>
    </ng-container>

    <p class="switch">
      Already have an account?
      <a routerLink="/login">Sign in</a>
    </p>
  </div></main>`,

  styles:[`
    .auth-page{min-height:70vh;display:grid;place-items:center;padding:50px 16px}
    .auth-card{width:min(430px,100%);padding:32px}
    .auth-card h1{margin:10px 0 8px}
    .auth-card form{display:grid;gap:16px;margin-top:26px}
    .field{display:grid;gap:7px}
    .field label{font-size:12px;font-weight:700}
    .field input{width:100%;box-sizing:border-box;border:1px solid var(--line);
      border-radius:10px;padding:12px;outline:0}
    .switch{text-align:center;color:#777;font-size:13px;margin-top:22px}
    .switch a{color:#111;font-weight:800}
    .auth-card .btn{width:100%;margin-top:4px}
    .error{color:#c62828;font-size:12px;margin:0}
    .success{color:#237a35;background:#eef9ef;padding:10px;border-radius:9px;
      font-size:12px;margin:0}
    .otp-actions{display:flex;justify-content:space-between;gap:12px;margin-top:15px}
    .text-btn{border:0;background:transparent;text-decoration:underline;
      cursor:pointer;font-size:12px}
    .text-btn:disabled{opacity:.5;cursor:not-allowed}
  `]
})
export class SignupComponent {
  private auth=inject(AuthService);
  private router=inject(Router);

  step=1;
  name='';
  phone='';
  password='';
  otp='';
  loading=false;
  error='';
  message='';

  async sendOtp(){
    this.error='';
    this.message='';

    if(!this.name.trim()){
      this.error='Please enter your name.';
      return;
    }

    if(!this.phone.trim()){
      this.error='Please enter your phone number.';
      return;
    }

    if(this.password.length<8){
      this.error='Password must be at least 8 characters.';
      return;
    }

    this.loading=true;
    localStorage.setItem('wissfind_signup_name',this.name.trim());
    localStorage.setItem('wissfind_signup_password',this.password);
    const result=await this.auth.signUp(this.phone,this.password,this.name);
    const error=result.error;
    const devOtp=(result as any).data?.devOtp;
    this.loading=false;

    if(error){
      this.error=error.message;
      return;
    }

    this.step=2;
    this.message=devOtp ? `OTP sent. Development OTP: ${devOtp}` : 'OTP sent. Verify your phone to complete registration.';
  }

  async verifyOtp(){
    this.error='';
    this.message='';

    const token=this.otp.trim();

    if(!/^\d{6}$/.test(token)){
      this.error='Enter the 6-digit OTP.';
      return;
    }

    this.loading=true;
    const {error}=await this.auth.verifySignupOtp(this.phone,token);
    this.loading=false;

    if(error){
      this.error=error.message;
      return;
    }

    this.message='Phone verified. Your WissFind account is ready.';
    await this.router.navigateByUrl('/');
  }

  async resendOtp(){
    this.error='';
    this.message='';
    this.loading=true;

    const {error}=await this.auth.resendSignupOtp(this.phone);
    this.loading=false;

    if(error){
      this.error=error.message;
      return;
    }

    this.message='A new OTP has been sent.';
  }
}
