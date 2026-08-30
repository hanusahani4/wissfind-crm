import { Component, inject } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  imports: [FormsModule, NgIf, RouterLink],
  template: `
  <main class="auth-page">
    <div class="auth-card card">
      <div class="eyebrow">ACCOUNT RECOVERY</div>

      <ng-container *ngIf="step === 1">
        <h1>Forgot password?</h1>
        <p class="muted">Enter your registered phone number and we'll send you a verification code.</p>
        <form (ngSubmit)="sendOtp()">
          <div class="field">
            <label>Phone number</label>
            <input name="phone" [(ngModel)]="phone" required autocomplete="tel"
                   placeholder="+91 98765 43210">
          </div>
          <p class="error" *ngIf="error">{{ error }}</p>
          <button class="btn" [disabled]="loading">
            {{ loading ? 'Sending code…' : 'Send verification code' }}
          </button>
        </form>
      </ng-container>

      <ng-container *ngIf="step === 2">
        <h1>Verify your number</h1>
        <p class="muted">Enter the OTP sent to <strong>{{phone}}</strong>.</p>
        <form (ngSubmit)="verifyOtp()">
          <div class="field">
            <label>Verification code</label>
            <input name="otp" [(ngModel)]="otp" required inputmode="numeric"
                   autocomplete="one-time-code" maxlength="6" placeholder="123456">
          </div>
          <p class="error" *ngIf="error">{{ error }}</p>
          <button class="btn" [disabled]="loading">
            {{ loading ? 'Verifying…' : 'Verify code' }}
          </button>
        </form>
        <button class="text-btn" type="button" (click)="step=1">Change phone number</button>
      </ng-container>

      <ng-container *ngIf="step === 3">
        <h1>Create new password</h1>
        <p class="muted">Choose a strong password for your WissFind account.</p>
        <form (ngSubmit)="changePassword()">
          <div class="field">
            <label>New password</label>
            <input type="password" name="password" [(ngModel)]="password" required
                   minlength="6" autocomplete="new-password">
          </div>
          <div class="field">
            <label>Confirm password</label>
            <input type="password" name="confirmPassword" [(ngModel)]="confirmPassword"
                   required minlength="6" autocomplete="new-password">
          </div>
          <p class="error" *ngIf="error">{{ error }}</p>
          <button class="btn" [disabled]="loading">
            {{ loading ? 'Updating…' : 'Reset password' }}
          </button>
        </form>
      </ng-container>

      <p class="success" *ngIf="success">{{success}}</p>
      <p class="switch"><a routerLink="/login">← Back to login</a></p>
    </div>
  </main>
  `,
  styles: [`
    .auth-page{min-height:70vh;display:grid;place-items:center;padding:50px 16px}
    .auth-card{width:min(430px,100%);padding:32px}
    .auth-card h1{margin:10px 0 8px}
    .auth-card form{display:grid;gap:16px;margin-top:26px}
    .field{display:grid;gap:7px}
    .field label{font-size:12px;font-weight:700}
    .field input{width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:10px;padding:12px;outline:0}
    .switch{text-align:center;color:#777;font-size:13px;margin-top:22px}
    .switch a{color:#111;font-weight:800}
    .auth-card .btn{width:100%;margin-top:4px}
    .error{color:#c62828;font-size:12px;margin:0}
    .success{color:#237a35;font-size:12px;background:#eef9ef;padding:10px;border-radius:9px}
    .text-btn{border:0;background:transparent;text-decoration:underline;cursor:pointer;font-size:12px;margin-top:15px}
  `]
})
export class ForgotPasswordComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  step = 1;
  phone = '';
  otp = '';
  password = '';
  confirmPassword = '';
  loading = false;
  error = '';
  success = '';

  async sendOtp() {
    this.loading = true; this.error = ''; this.success = '';
    const result = await this.auth.sendPasswordResetOtp(this.phone);
    const error = result.error;
    const devOtp = (result as any).data?.devOtp;
    this.loading = false;
    if (error) { this.error = error.message; return; }
    this.step = 2;
    this.success = devOtp ? `Verification code sent. Development OTP: ${devOtp}` : 'Verification code sent.';
  }

  async verifyOtp() {
    this.loading = true; this.error = ''; this.success = '';
    const { error } = await this.auth.verifyPasswordResetOtp(this.phone, this.otp);
    this.loading = false;
    if (error) { this.error = error.message; return; }
    this.step = 3;
    this.success = '';
  }

  async changePassword() {
    this.error = ''; this.success = '';
    if (this.password.length < 6) {
      this.error = 'Password must contain at least 6 characters.';
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.error = 'Passwords do not match.';
      return;
    }

    this.loading = true;
    const { error } = await this.auth.updatePassword(this.password);
    this.loading = false;

    if (error) { this.error = error.message; return; }

    this.success = 'Password updated successfully. Redirecting to login…';
    setTimeout(() => this.router.navigateByUrl('/login'), 1000);
  }
}
