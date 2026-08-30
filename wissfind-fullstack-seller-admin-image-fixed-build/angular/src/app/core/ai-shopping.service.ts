import { Injectable, inject } from '@angular/core';
import { ProductService } from './product.service';
import { Product } from './product.model';
import { CartService } from './cart.service';

export interface ShoppingRequirements {
  budget: number | null;
  category: 'Fashion' | 'Electronics' | 'Home & Living' | 'Beauty' | 'Sports & Fitness' | 'Books & Stationery' | 'Grocery' | 'Travel' | null;
  intent: string[];
  wantsGaming: boolean;
  wantsCollege: boolean;
  wantsPhone: boolean;
  wantsAudio: boolean;
  wantsFashion: boolean;
}

export interface AgentRecommendation {
  product: Product;
  reason: string;
  score: number;
}

@Injectable({ providedIn: 'root' })
export class AiShoppingService {
  private readonly products = inject(ProductService);
  private readonly cart = inject(CartService);

  parse(message: string): ShoppingRequirements {
    const text = message.toLowerCase();
    const budgetMatch = text.replace(/,/g, '').match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(k|thousand|lakh|l)?/i);

    let budget: number | null = null;
    if (budgetMatch) {
      const value = Number(budgetMatch[1]);
      const unit = (budgetMatch[2] || '').toLowerCase();
      budget = unit === 'k' || unit === 'thousand' ? value * 1000 :
               unit === 'lakh' || unit === 'l' ? value * 100000 : value;
    }

    return {
      budget,
      category: text.includes('fashion') || text.includes('clothes') || text.includes('men') || text.includes('women') ? 'Fashion' :
                text.includes('electronic') || text.includes('tech') || text.includes('laptop') ? 'Electronics' :
                text.includes('home') || text.includes('furniture') || text.includes('decor') ? 'Home & Living' :
                text.includes('beauty') || text.includes('skincare') || text.includes('makeup') ? 'Beauty' :
                text.includes('sport') || text.includes('fitness') || text.includes('gym') || text.includes('running') ? 'Sports & Fitness' :
                text.includes('book') || text.includes('stationery') || text.includes('notebook') ? 'Books & Stationery' :
                text.includes('grocery') || text.includes('snack') || text.includes('coffee') ? 'Grocery' :
                text.includes('travel') || text.includes('luggage') || text.includes('backpack') ? 'Travel' : null,
      intent: [
        ...(text.includes('gaming') ? ['gaming'] : []),
        ...(text.includes('college') || text.includes('student') ? ['college'] : []),
        ...(text.includes('phone') || text.includes('mobile') ? ['phone'] : []),
        ...(text.includes('audio') || text.includes('headphone') ? ['audio'] : []),
      ],
      wantsGaming: text.includes('gaming'),
      wantsCollege: text.includes('college') || text.includes('student'),
      wantsPhone: text.includes('phone') || text.includes('mobile'),
      wantsAudio: text.includes('audio') || text.includes('headphone'),
      wantsFashion: text.includes('fashion') || text.includes('clothes')
    };
  }

  recommend(requirements: ShoppingRequirements): AgentRecommendation[] {
    const all = this.products.products;
    const budget = requirements.budget ?? Infinity;

    const scored = all.map(product => {
      const haystack = [
        product.name, product.description, product.subcategory, ...product.tags
      ].join(' ').toLowerCase();

      let score = product.rating * 12;

      if (requirements.wantsGaming) {
        if (haystack.includes('gaming')) score += 70;
        if (haystack.includes('laptop')) score += 55;
        if (haystack.includes('mouse') || haystack.includes('keyboard') || haystack.includes('headset')) score += 45;
      }

      if (requirements.wantsCollege) {
        if (haystack.includes('college') || haystack.includes('student') || haystack.includes('backpack')) score += 55;
        if (haystack.includes('laptop') || haystack.includes('tablet')) score += 30;
      }

      if (requirements.wantsPhone && product.subcategory === 'Smartphones') score += 90;
      if (requirements.wantsAudio && (product.subcategory === 'Audio' || haystack.includes('audio'))) score += 65;
      if (requirements.wantsFashion && product.category === 'Fashion') score += 70;

      if (product.price > budget && budget !== Infinity) score -= 80;
      if (product.oldPrice) score += Math.min(20, ((product.oldPrice - product.price) / product.oldPrice) * 100);

      return { product, score };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .map(x => ({
        product: x.product,
        score: Math.round(x.score),
        reason: this.reasonFor(x.product, requirements)
      }));
  }

  buildSmartCart(requirements: ShoppingRequirements): Product[] {
    const budget = requirements.budget ?? 60000;
    const ranked = this.recommend(requirements).map(x => x.product);

    // Bundle templates are deterministic guardrails around the AI interpretation.
    if (requirements.wantsGaming && requirements.wantsCollege) {
      const wanted = [
        'gaming-laptop-01',
        'gaming-mouse-01',
        'gaming-keyboard-01',
        'college-backpack-01',
        'gaming-headset-01'
      ];
      return this.fitBudget(wanted, ranked, budget);
    }

    if (requirements.wantsPhone) {
      const phones = ranked.filter(p => p.subcategory === 'Smartphones');
      return phones.slice(0, 1);
    }

    return this.fitBudget([], ranked, budget);
  }

  optimizeCurrentCart(newBudget: number): Product[] {
    const current = this.cart.cart().flatMap(item => Array(item.quantity).fill(item.product));
    if (!current.length) return [];
    return this.fitBudget([], current, newBudget);
  }

  applyProducts(products: Product[]) {
    this.cart.clear();
    products.forEach(product => this.cart.add(product));
  }

  private fitBudget(preferredIds: string[], ranked: Product[], budget: number): Product[] {
    const chosen: Product[] = [];
    const used = new Set<string>();

    for (const id of preferredIds) {
      const p = ranked.find(x => x.id === id) ?? this.products.products.find(x => x.id === id);
      if (!p || used.has(p.id)) continue;
      if (chosen.reduce((s, x) => s + x.price, 0) + p.price <= budget) {
        chosen.push(p);
        used.add(p.id);
      }
    }

    for (const p of ranked) {
      if (used.has(p.id)) continue;
      if (chosen.reduce((s, x) => s + x.price, 0) + p.price <= budget) {
        const compatible = !chosen.length ||
          p.category === 'Electronics' ||
          p.tags.some(t => ['college','student','gaming','accessory','audio'].includes(t));
        if (compatible) {
          chosen.push(p);
          used.add(p.id);
        }
      }
      if (chosen.length >= 5) break;
    }

    return chosen;
  }

  private reasonFor(product: Product, req: ShoppingRequirements): string {
    const tags = product.tags.join(', ');
    if (req.wantsGaming && req.wantsCollege && product.id === 'gaming-laptop-01')
      return 'Core of the setup: suitable for classes, coding and gaming.';
    if (req.wantsGaming && ['gaming-mouse-01','gaming-keyboard-01','gaming-headset-01'].includes(product.id))
      return 'Gaming accessory selected to complete the setup.';
    if (req.wantsCollege && product.id === 'college-backpack-01')
      return 'Adds a practical campus carry option for the laptop.';
    return `Strong match based on rating, category and ${tags} relevance.`;
  }
}
