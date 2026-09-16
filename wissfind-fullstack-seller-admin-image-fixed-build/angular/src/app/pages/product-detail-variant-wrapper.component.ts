import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ProductService } from '../core/product.service';
import { ProductDetailComponent } from './product-detail.component';
import { ProductVariantSelectorComponent } from './product-variant-selector.component';

@Component({
  standalone: true,
  selector: 'app-product-detail-variant-wrapper',
  imports: [CommonModule, ProductDetailComponent, ProductVariantSelectorComponent],
  template: `<app-product-detail></app-product-detail><app-product-variant-selector *ngIf="product" [product]="product"></app-product-variant-selector>`
})
export class ProductDetailVariantWrapperComponent {
  private route = inject(ActivatedRoute);
  private products = inject(ProductService);
  product = this.products.getById(this.route.snapshot.paramMap.get('id') || '');
}
