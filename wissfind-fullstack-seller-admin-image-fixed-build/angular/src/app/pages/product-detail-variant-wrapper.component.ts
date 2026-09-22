import { Component } from '@angular/core';
import { ProductDetailComponent } from './product-detail.component';

@Component({
  standalone: true,
  selector: 'app-product-detail-variant-wrapper',
  imports: [ProductDetailComponent],
  template: `
    <app-product-detail></app-product-detail>
  `
})
export class ProductDetailVariantWrapperComponent {}
