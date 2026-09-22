import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
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
export class ProductDetailVariantWrapperComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private products = inject(ProductService);
  product: any;

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      const stateProduct = typeof history !== 'undefined' ? (history.state?.product as any) : undefined;
      if (id) {
        if (stateProduct && String(stateProduct.id) === String(id)) {
          this.product = stateProduct;
        }
        void this.loadProduct(id);
      }
    });
  }

  private async loadProduct(id: string) {
    const product = await this.products.getByIdAsync(id);
    if (String(this.route.snapshot.paramMap.get('id')) === String(id) && product) {
      this.product = product;
    }
  }

  ngOnDestroy() {}
}
