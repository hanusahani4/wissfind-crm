import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ProductDetailComponent } from './product-detail.component';

@Component({
  standalone: true,
  selector: 'app-product-detail-variant-wrapper',
  imports: [ProductDetailComponent],
  template: `
    <app-product-detail (click)="handleProductDetailClick($event)"></app-product-detail>
  `
})
export class ProductDetailVariantWrapperComponent {
  constructor(private readonly router: Router) {}

  handleProductDetailClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    const addToBagButton = target?.closest('button.btn.add');

    if (!addToBagButton) return;

    // Let ProductDetailComponent finish its cart update first, then navigate.
    // The fallback guarantees a cart page even if the Angular router rejects
    // the imperative navigation for any reason.
    setTimeout(() => {
      this.router.navigateByUrl('/cart').then((navigated) => {
        if (!navigated) {
          window.location.assign('/cart');
        }
      }).catch(() => {
        window.location.assign('/cart');
      });
    }, 0);
  }
}
