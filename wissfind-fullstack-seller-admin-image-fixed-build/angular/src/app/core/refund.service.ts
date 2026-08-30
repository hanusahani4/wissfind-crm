import { Injectable, signal } from '@angular/core';

export type RefundType = 'Return' | 'Cancellation';
export type RefundStatus = 'Requested' | 'Approved' | 'Pickup scheduled' | 'Picked up' | 'Refund initiated' | 'Refund completed';

export interface RefundTracking {
  id: string;
  type: RefundType;
  orderId: string;
  product: string;
  amount: number;
  refundAmount: number;
  paymentMethod: string;
  reason: string;
  note: string;
  current: number;
  steps: RefundStatus[];
  createdAt: string;
  expectedDate?: string;
}

@Injectable({ providedIn: 'root' })
export class RefundService {
  private readonly key = 'wissfind_refund_tracking';
  readonly refunds = signal<RefundTracking[]>(this.load());

  private load(): RefundTracking[] {
    try {
      const raw = localStorage.getItem(this.key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private save(items: RefundTracking[]) {
    localStorage.setItem(this.key, JSON.stringify(items));
    this.refunds.set(items);
  }

  addRequest(input: {
    orderId: string;
    product: string;
    type: RefundType;
    amount: number;
    refundAmount: number;
    paymentMethod: string;
    reason: string;
  }): RefundTracking {
    const existing = this.refunds().find(x => x.orderId === input.orderId && x.type === input.type && x.current < x.steps.length - 1);
    if (existing) return existing;

    const isCancellation = input.type === 'Cancellation';
    const steps: RefundStatus[] = isCancellation
      ? ['Requested', 'Approved', 'Refund initiated', 'Refund completed']
      : ['Requested', 'Approved', 'Pickup scheduled', 'Picked up', 'Refund initiated', 'Refund completed'];

    const item: RefundTracking = {
      id: `${isCancellation ? 'CAN' : 'RET'}-${Date.now().toString().slice(-7)}`,
      type: input.type,
      orderId: input.orderId,
      product: input.product,
      amount: input.amount,
      refundAmount: input.refundAmount,
      paymentMethod: input.paymentMethod,
      reason: input.reason,
      note: isCancellation
        ? 'Cancellation approved. Refund will be sent to the original payment method.'
        : 'Return request received. Pickup and refund updates will appear here.',
      current: 0,
      steps,
      createdAt: new Date().toISOString()
    };

    this.save([item, ...this.refunds()]);
    return item;
  }

  advance(id: string) {
    const updated = this.refunds().map(x => {
      if (x.id !== id) return x;
      const current = Math.min(x.current + 1, x.steps.length - 1);
      return {
        ...x,
        current,
        note: current === x.steps.length - 1
          ? `Refund of ₹${x.refundAmount.toLocaleString('en-IN')} completed to ${x.paymentMethod}.`
          : `${x.steps[current]} is now in progress.`
      };
    });
    this.save(updated);
  }
}
