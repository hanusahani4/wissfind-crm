import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class RazorpayLoaderService {
  private loading: Promise<void> | null = null;

  load(): Promise<void> {
    if (typeof window === 'undefined') return Promise.resolve();
    if ((window as any).Razorpay) return Promise.resolve();
    if (this.loading) return this.loading;

    this.loading = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector('script[data-wissfind-razorpay]') as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('Razorpay checkout could not be loaded.')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.dataset.wissfindRazorpay = 'true';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Razorpay checkout could not be loaded. Please refresh and try again.'));
      document.head.appendChild(script);
    }).catch(error => {
      this.loading = null;
      throw error;
    });

    return this.loading;
  }
}
