import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { RazorpayLoaderService } from './razorpay-loader.service';

export const razorpayCheckoutGuard: CanActivateFn = async () => {
  await inject(RazorpayLoaderService).load();
  return true;
};
