import { Injectable, computed, signal } from '@angular/core';
import { Product } from './product.model';

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface CartCharges {
  subtotal: number;
  productDiscount: number;
  couponDiscount: number;
  shippingCost: number;
  gst: number;
  platformFee: number;
  handlingFee: number;
  convenienceFee: number;
  giftWrapFee: number;
  totalSavings: number;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly items = signal<CartItem[]>(this.load());
  readonly cart = this.items.asReadonly();

  readonly count = computed(() =>
    this.items().reduce((sum, item) => sum + Math.max(0, item.quantity), 0)
  );

  /**
   * Subtotal is ALWAYS the current selling price, not MRP.
   * oldPrice is used only to show the customer's savings.
   */
  readonly subtotal = computed(() =>
    this.items().reduce((sum, item) => {
      const price = Math.max(0, Number(item.product.price) || 0);
      const quantity = Math.max(0, Number(item.quantity) || 0);
      return sum + price * quantity;
    }, 0)
  );

  readonly couponCode = signal<string>('');
  readonly giftWrap = signal<boolean>(false);
  /** Customer payment choice controls delivery pricing. */
  readonly paymentMethod = signal<'COD' | 'RAZORPAY'>('COD');

  setPaymentMethod(method: 'COD' | 'RAZORPAY') {
    this.paymentMethod.set(method === 'RAZORPAY' ? 'RAZORPAY' : 'COD');
  }

  /**
   * Product discount is display-only savings:
   * MRP - selling price.
   *
   * IMPORTANT: it must NOT be subtracted from subtotal again because
   * subtotal already contains the discounted selling price.
   */
  readonly productDiscount = computed(() =>
    Math.round(this.items().reduce((sum, item) => {
      const price = Math.max(0, Number(item.product.price) || 0);
      const oldPrice = Math.max(price, Number(item.product.oldPrice) || price);
      return sum + Math.max(0, oldPrice - price) * Math.max(0, item.quantity);
    }, 0))
  );

  readonly couponDiscount = computed(() => {
    const code = this.couponCode().trim().toUpperCase();

    if (code !== 'WISS10') {
      return 0;
    }

    // Coupon is calculated on the actual selling-price subtotal.
    return Math.round(this.subtotal() * 0.10);
  });

  /**
   * Delivery pricing: below ₹200, COD costs ₹70 and online payment costs ₹20.
   * At/above ₹200 delivery is free for both methods.
   */
  readonly shippingCost = computed(() => this.shippingFor(this.paymentMethod()));

  readonly platformFee = computed(() => 0);
  readonly handlingFee = computed(() => 0);
  readonly convenienceFee = computed(() => 0);

  readonly giftWrapFee = computed(() =>
    this.giftWrap() && this.subtotal() > 0 ? 49 : 0
  );

  readonly taxableAmount = computed(() =>
    Math.max(0, this.subtotal() - this.couponDiscount() + this.shippingCost() + this.giftWrapFee())
  );

  /** GST/platform/handling/convenience are intentionally zero for checkout. */
  readonly gst = computed(() => 0);

  readonly totalSavings = computed(() =>
    this.productDiscount() + this.couponDiscount()
  );

  readonly total = computed(() => this.totalFor(this.paymentMethod()));

  readonly codTotal = computed(() => this.totalFor('COD'));
  readonly razorpayTotal = computed(() => this.totalFor('RAZORPAY'));
  readonly razorpaySavings = computed(() => Math.max(0, this.codTotal() - this.razorpayTotal()));

  shippingFor(method: 'COD' | 'RAZORPAY') {
    const payableProducts = Math.max(0, this.subtotal() - this.couponDiscount());
    if (payableProducts <= 0 || payableProducts >= 200) return 0;
    return method === 'COD' ? 70 : 20;
  }

  totalFor(method: 'COD' | 'RAZORPAY') {
    return Math.max(0, Math.round(
      this.subtotal()
      - this.couponDiscount()
      + this.shippingFor(method)
      + this.giftWrapFee()
    ));
  }

  readonly summary = computed<CartCharges>(() => ({
    subtotal: this.subtotal(),
    productDiscount: this.productDiscount(),
    couponDiscount: this.couponDiscount(),
    shippingCost: this.shippingCost(),
    gst: this.gst(),
    platformFee: this.platformFee(),
    handlingFee: this.handlingFee(),
    convenienceFee: this.convenienceFee(),
    giftWrapFee: this.giftWrapFee(),
    totalSavings: this.totalSavings(),
    total: this.total()
  }));

  add(product: Product) {
    if (!product || !product.id) {
      return;
    }

    const existing = this.items().find(
      item => item.product.id === product.id
    );

    this.items.update(items =>
      existing
        ? items.map(item =>
            item.product.id === product.id
              ? {
                  ...item,
                  quantity: Math.max(1, item.quantity + 1)
                }
              : item
          )
        : [...items, { product, quantity: 1 }]
    );

    this.persist();
  }

  update(productId: string, quantity: number) {
    const safeQuantity = Math.max(0, Math.floor(Number(quantity) || 0));

    this.items.update(items =>
      safeQuantity <= 0
        ? items.filter(item => item.product.id !== productId)
        : items.map(item =>
            item.product.id === productId
              ? { ...item, quantity: safeQuantity }
              : item
          )
    );

    this.persist();
  }

  remove(productId: string) {
    this.items.update(items =>
      items.filter(item => item.product.id !== productId)
    );

    this.persist();
  }

  applyCoupon(code: string): boolean {
    const normalized = code.trim().toUpperCase();

    if (normalized === 'WISS10') {
      this.couponCode.set(normalized);
      return true;
    }

    this.couponCode.set('');
    return false;
  }

  removeCoupon() {
    this.couponCode.set('');
  }

  setGiftWrap(enabled: boolean) {
    this.giftWrap.set(!!enabled);
  }

  clear() {
    this.items.set([]);
    this.couponCode.set('');
    this.giftWrap.set(false);
    this.persist();
  }

  private persist() {
    try {
      localStorage.setItem(
        'wissfind-cart',
        JSON.stringify(this.items())
      );
    } catch {
      // Storage can be unavailable in private/restricted browser contexts.
    }
  }

  private load(): CartItem[] {
    try {
      const raw = localStorage.getItem('wissfind-cart');

      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter(item =>
          item &&
          item.product &&
          item.product.id &&
          Number(item.quantity) > 0
        )
        .map(item => ({
          product: item.product as Product,
          quantity: Math.max(1, Math.floor(Number(item.quantity)))
        }));
    } catch {
      return [];
    }
  }
}
