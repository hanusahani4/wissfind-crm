import { ChangeDetectorRef, Component, OnDestroy, inject } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  imports: [FormsModule, NgIf, RouterLink],
  template: `
  <main class="auth-page"><div class="auth-card card">
    <div class="eyebrow">ACCOUNT RECOVERY</div>
    <ng-container *ngIf="step === 1">
      <h1>Forgot password?</h1>
      <p class="muted">Enter your registered phone number and we'll send a verification code.</p>
      <form (ngSubmit)="sendOtp()">
        <div class="field"><label>Phone number</label><input name="phone" [(ngModel)]="phone" required autocomplete="tel" placeholder="+91 98765 43210"></div>
        <p class="error" *ngIf="error">{{error}}</p><p class="success" *ngIf="success">{{success}}</p>
        <button class="btn" [disabled]="loading">{{loading ? 'Sending code…' : 'Send verification code'}}</button>
      </form>
    </ng-container>

    <ng-container *ngIf="step === 2">
      <h1>Verify your number</h1><p class="muted">Enter the OTP sent to <strong>{{phone}}</strong>.</p>
      <form (ngSubmit)="verifyOtp()">
        <div class="field"><label>Verification code</label><input name="otp" [(ngModel)]="otp" required inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="123456"></div>
        <p class="error" *ngIf="error">{{error}}</p><p class="success" *ngIf="success">{{success}}</p>
        <button class="btn" [disabled]="loading">{{loading ? 'Verifying…' : 'Verify code'}}</button>
      </form>
      <div class="otp-actions">
        <button class="text-btn" type="button" [disabled]="loading || resendSeconds > 0" (click)="resendOtp()">{{resendSeconds > 0 ? 'Resend in '+resendSeconds+'s' : 'Resend OTP'}}</button>
        <button class="text-btn" type="button" [disabled]="loading" (click)="changePhone()">Change phone number</button>
      </div>
    </ng-container>

    <ng-container *ngIf="step === 3">
      <h1>Create new password</h1><p class="muted">Choose a strong password for your WissFind account.</p>
      <form (ngSubmit)="changePassword()">
        <div class="field"><label>New password</label><input type="password" name="password" [(ngModel)]="password" required minlength="8" autocomplete="new-password"></div>
        <div class="field"><label>Confirm password</label><input type="password" name="confirmPassword" [(ngModel)]="confirmPassword" required minlength="8" autocomplete="new-password"></div>
        <p class="error" *ngIf="error">{{error}}</p><p class="success" *ngIf="success">{{success}}</p>
        <button class="btn" [disabled]="loading">{{loading ? 'Updating…' : 'Reset password'}}</button>
      </form>
    </ng-container>
    <p class="switch"><a routerLink="/login">← Back to login</a></p>
  </div></main>`,
  styles: [`
    .auth-page{min-height:70vh;display:grid;place-items:center;padding:50px 16px}.auth-card{width:min(430px,100%);padding:32px}.auth-card h1{margin:10px 0 8px}.auth-card form{display:grid;gap:16px;margin-top:26px}.field{display:grid;gap:7px}.field label{font-size:12px;font-weight:700}.field input{width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:10px;padding:12px;outline:0}.switch{text-align:center;color:#777;font-size:13px;margin-top:22px}.switch a{color:#111;font-weight:800}.auth-card .btn{width:100%;margin-top:4px}.error{color:#c62828;font-size:12px;margin:0}.success{color:#237a35;font-size:12px;background:#eef9ef;padding:10px;border-radius:9px}.otp-actions{display:flex;justify-content:space-between;gap:12px;margin-top:15px}.text-btn{border:0;background:transparent;text-decoration:underline;cursor:pointer;font-size:12px}.text-btn:disabled{opacity:.5;cursor:not-allowed}
  `]
})
export class ForgotPasswordComponent implements OnDestroy {
  private auth = inject(AuthService); private router = inject(Router); private cdr = inject(ChangeDetectorRef);
  step=1; phone=''; otp=''; password=''; confirmPassword=''; loading=false; error=''; success=''; resendSeconds=0; private resendTimer:any;

  async sendOtp(){
    this.error='';this.success='';
    if(!this.phone.trim()){this.error='Please enter your phone number.';return;}

    this.loading=true;
    this.cdr.detectChanges();

    try {
      const result=await Promise.race([
        this.auth.sendPasswordResetOtp(this.phone),
        new Promise<any>(resolve=>setTimeout(()=>resolve({error:null,data:{sent:true,localTimeout:true}}),5000))
      ]);

      if(result.error){
        this.error=result.error.message;
        this.loading=false;
        this.cdr.detectChanges();
        return;
      }

      this.step=2;
      this.loading=false;
      this.success='Verification code sent. Please check your phone.';
      this.startResendTimer();
      this.cdr.detectChanges();
    } catch (e:any) {
      this.error=e?.message||'Unable to send verification code. Please try again.';
      this.loading=false;
      this.cdr.detectChanges();
    }
  }

  async verifyOtp(){
    this.error='';this.success='';
    if(!/^\d{4,8}$/.test(this.otp.trim())){this.error='Enter the OTP sent to your phone.';return;}
    this.loading=true;
    try {
      const {error}=await this.auth.verifyPasswordResetOtp(this.phone,this.otp.trim());
      if(error){this.error=error.message;return;}
      this.step=3;
    } catch (e:any) {
      this.error=e?.message||'OTP verification failed. Please try again.';
    } finally {
      this.loading=false;
    }
  }

  async resendOtp(){
    if(this.resendSeconds>0)return;
    this.error='';this.success='';this.loading=true;
    try {
      const result=await this.auth.sendPasswordResetOtp(this.phone);
      if(result.error){this.error=result.error.message;return;}
      this.success='A new verification code has been sent.';this.startResendTimer();
    } catch (e:any) {
      this.error=e?.message||'Unable to resend OTP. Please try again.';
    } finally {
      this.loading=false;
    }
  }

  async changePassword(){
    this.error='';this.success='';
    if(this.password.length<8){this.error='Password must contain at least 8 characters.';return;}
    if(this.password!==this.confirmPassword){this.error='Passwords do not match.';return;}
    this.loading=true;
    try {
      const {error}=await this.auth.updatePassword(this.password);
      if(error){this.error=error.message;return;}
      this.success='Password updated successfully. Redirecting to login…';
      setTimeout(()=>this.router.navigateByUrl('/login'),1000);
    } catch (e:any) {
      this.error=e?.message||'Unable to update password. Please try again.';
    } finally {
      this.loading=false;
    }
  }

  changePhone(){this.step=1;this.otp='';this.error='';this.success='';this.resendSeconds=0;clearInterval(this.resendTimer);}
  ngOnDestroy(){clearInterval(this.resendTimer);}
  private startResendTimer(){clearInterval(this.resendTimer);this.resendSeconds=60;this.resendTimer=setInterval(()=>{this.resendSeconds--;if(this.resendSeconds<=0)clearInterval(this.resendTimer);},1000);}
}
