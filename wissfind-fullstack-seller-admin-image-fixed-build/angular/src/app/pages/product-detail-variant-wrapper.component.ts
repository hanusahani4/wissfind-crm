import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ProductService } from '../core/product.service';
import { ProductDetailComponent } from './product-detail.component';
import { ProductVariantSelectorComponent } from './product-variant-selector.component';

@Component({
  standalone: true,
  selector: 'app-product-detail-variant-wrapper',
  imports: [CommonModule, ProductDetailComponent, ProductVariantSelectorComponent],
  template: `
    <app-product-detail></app-product-detail>
    <app-product-variant-selector *ngIf="product" [product]="product"></app-product-variant-selector>
  `
})
export class ProductDetailVariantWrapperComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private products = inject(ProductService);
  product: any;

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.product = await this.products.getByIdAsync(id);
  }
}
