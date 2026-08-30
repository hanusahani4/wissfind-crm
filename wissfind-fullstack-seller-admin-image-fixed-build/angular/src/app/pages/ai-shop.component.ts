import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AiShoppingService, AgentRecommendation, ShoppingRequirements } from '../core/ai-shopping.service';
import { CartService } from '../core/cart.service';
import { Product } from '../core/product.model';

@Component({
  selector: 'app-ai-shop',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DecimalPipe],
  template: `
    <main class="ai-page">
      <section class="container">
        <div class="hero">
          <div>
            <span class="eyebrow">WISSFIND AI</span>
            <h1>Build your shopping cart with AI.</h1>
            <p>Tell me what you need, your budget and what matters most. I'll search the catalog, compare products and build a budget-aware cart.</p>
            <div class="examples">
              <button type="button" *ngFor="let example of examples" (click)="useExample(example)">{{ example }}</button>
            </div>
          </div>
          <div class="hero-art">
            <div class="orb">✦</div>
            <strong>Smart Cart Agent</strong>
            <span>Understand → Search → Compare → Optimize</span>
          </div>
        </div>

        <section class="workspace">
          <div class="chat-card">
            <div class="chat-head">
              <div>
                <span class="eyebrow">SHOPPING ASSISTANT</span>
                <h2>What are you shopping for?</h2>
              </div>
              <span class="live">AI READY</span>
            </div>

            <div class="messages">
              <div class="message assistant">
                Hi! Tell me something like <b>“₹60,000 mein college + gaming setup chahiye.”</b>
              </div>
              <div class="message user" *ngIf="lastPrompt()">{{ lastPrompt() }}</div>
              <div class="message assistant" *ngIf="response()">{{ response() }}</div>
            </div>

            <div class="composer">
              <textarea [(ngModel)]="prompt"
                        rows="3"
                        placeholder="Example: ₹60,000 mein college + gaming setup chahiye..."></textarea>
              <button type="button" class="primary" (click)="runAgent()">Build my smart cart →</button>
            </div>
          </div>

          <aside class="requirements-card">
            <span class="eyebrow">UNDERSTOOD REQUIREMENTS</span>
            <div class="req-grid">
              <div><small>Budget</small><strong>{{ requirements().budget ? ('₹' + (requirements().budget | number)) : '—' }}</strong></div>
              <div><small>Goal</small><strong>{{ goalLabel() }}</strong></div>
              <div><small>Gaming</small><strong>{{ requirements().wantsGaming ? 'Yes' : 'No' }}</strong></div>
              <div><small>College</small><strong>{{ requirements().wantsCollege ? 'Yes' : 'No' }}</strong></div>
            </div>
            <p *ngIf="requirements().intent.length">Matched: {{ requirements().intent.join(' · ') }}</p>
          </aside>
        </section>

        <section class="results" *ngIf="recommendations().length">
          <div class="section-head">
            <div>
              <span class="eyebrow">AI RECOMMENDATION</span>
              <h2>Recommended smart cart</h2>
              <p>{{ recommendations().length }} products selected with your budget in mind.</p>
            </div>
            <div class="cart-total">
              <small>Recommended total</small>
              <strong>₹{{ recommendedTotal() | number }}</strong>
              <span *ngIf="requirements().budget">Budget: ₹{{ requirements().budget | number }}</span>
            </div>
          </div>

          <div class="product-grid">
            <article class="product-card" *ngFor="let item of recommendations()">
              <a [routerLink]="['/product', item.product.id]" class="image">
                <img [src]="item.product.image" [alt]="item.product.name">
              </a>
              <div class="body">
                <div class="meta">{{ item.product.category }} · {{ item.product.subcategory }}</div>
                <h3>{{ item.product.name }}</h3>
                <div class="rating">★ {{ item.product.rating }} <span>({{ item.product.reviews }})</span></div>
                <p>{{ item.reason }}</p>
                <strong>₹{{ item.product.price | number }}</strong>
              </div>
            </article>
          </div>

          <div class="actions-row">
            <button type="button" class="primary" (click)="addRecommendedCart()">Add complete setup to cart →</button>
            <a routerLink="/cart" class="secondary">View cart</a>
          </div>
        </section>

        <section class="optimize" *ngIf="recommendations().length">
          <div>
            <span class="eyebrow">LIVE OPTIMIZER</span>
            <h2>Change the budget</h2>
            <p>Tell the agent a new budget and it will rebuild the recommendation around it.</p>
          </div>
          <div class="optimizer">
            <input type="number" [(ngModel)]="newBudget" min="1000" step="500" placeholder="50000">
            <button type="button" class="secondary" (click)="optimize()">Optimize to ₹{{ newBudget | number }}</button>
          </div>
        </section>

        <section class="how">
          <span class="eyebrow">HOW IT WORKS</span>
          <div class="steps">
            <div><b>01</b><strong>Understand</strong><span>Extract budget, intent and priorities from natural language.</span></div>
            <div><b>02</b><strong>Search</strong><span>Match the request against your WissFind product catalog.</span></div>
            <div><b>03</b><strong>Compare</strong><span>Use price, rating, tags and category relevance to rank products.</span></div>
            <div><b>04</b><strong>Optimize</strong><span>Build a compatible bundle without exceeding the budget.</span></div>
          </div>
        </section>
      </section>
    </main>
  `,
  styles: [`
    .ai-page{padding:34px 0 90px;background:#f7f7f5;min-height:70vh}
    .hero{display:grid;grid-template-columns:1.5fr .8fr;gap:28px;background:#111;color:#fff;border-radius:28px;padding:48px;margin-bottom:24px;overflow:hidden}
    .eyebrow{font-size:10px;letter-spacing:.14em;font-weight:800;color:#777}.hero .eyebrow{color:#aaa}
    h1{font-size:clamp(38px,5vw,66px);line-height:.98;letter-spacing:-.055em;max-width:720px;margin:16px 0}
    .hero p{max-width:680px;color:#c8c8c8;line-height:1.7;font-size:16px}
    .examples{display:flex;gap:8px;flex-wrap:wrap;margin-top:24px}.examples button{border:1px solid #444;background:#1d1d1d;color:#fff;border-radius:999px;padding:10px 13px;cursor:pointer}
    .hero-art{border:1px solid #333;border-radius:22px;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:12px;min-height:240px;background:radial-gradient(circle at 50% 35%,#3a3a3a,#141414 55%)}
    .hero-art span{font-size:12px;color:#aaa}.orb{width:92px;height:92px;border-radius:50%;display:grid;place-items:center;font-size:42px;background:#fff;color:#111;box-shadow:0 0 60px rgba(255,255,255,.18)}
    .workspace{display:grid;grid-template-columns:1fr 340px;gap:18px}
    .chat-card,.requirements-card,.results,.optimize,.how{background:#fff;border:1px solid var(--line);border-radius:22px}
    .chat-card{padding:24px}.chat-head{display:flex;justify-content:space-between;gap:15px;align-items:flex-start}.chat-head h2{margin:8px 0 0;font-size:25px}
    .live{font-size:10px;font-weight:800;background:#111;color:#fff;border-radius:999px;padding:7px 10px}
    .messages{display:grid;gap:10px;margin:24px 0}.message{max-width:82%;padding:13px 15px;border-radius:16px;font-size:14px;line-height:1.5}.assistant{background:#f3f3f1}.user{background:#111;color:#fff;margin-left:auto}
    .composer{border:1px solid var(--line);border-radius:16px;padding:10px;display:grid;gap:10px}.composer textarea{border:0;outline:0;resize:vertical;font:inherit;padding:8px;min-height:70px}
    .primary,.secondary{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:12px 17px;font-weight:800;border:1px solid #111;cursor:pointer;text-decoration:none}
    .primary{background:#111;color:#fff}.secondary{background:#fff;color:#111}
    .requirements-card{padding:22px;height:max-content}.req-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:18px 0}.req-grid div{background:#f6f6f4;border-radius:14px;padding:13px;display:grid;gap:5px}.req-grid small{color:#777}.req-grid strong{font-size:14px}.requirements-card p{font-size:12px;color:#666}
    .results{margin-top:18px;padding:26px}.section-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-end;margin-bottom:20px}.section-head h2,.optimize h2{font-size:30px;margin:8px 0}.section-head p,.optimize p{color:#777;margin:0}.cart-total{text-align:right}.cart-total small,.cart-total span{display:block;color:#777;font-size:11px}.cart-total strong{display:block;font-size:25px;margin:4px 0}
    .product-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px}.product-card{border:1px solid var(--line);border-radius:16px;overflow:hidden;background:#fff}.image{display:block;aspect-ratio:4/4.6;background:#eee}.image img{width:100%;height:100%;object-fit:cover}.body{padding:12px}.meta{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#888}.body h3{font-size:14px;margin:7px 0}.rating{font-size:12px}.rating span{color:#888}.body p{font-size:11px;color:#666;line-height:1.45;min-height:46px}.body>strong{font-size:14px}
    .actions-row{display:flex;gap:10px;justify-content:center;margin-top:22px}
    .optimize{margin-top:18px;padding:25px;display:flex;justify-content:space-between;gap:20px;align-items:center}.optimizer{display:flex;gap:8px}.optimizer input{width:150px;border:1px solid var(--line);border-radius:999px;padding:12px 14px;font:inherit}
    .how{margin-top:18px;padding:26px}.steps{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:18px}.steps div{border:1px solid var(--line);border-radius:16px;padding:17px;display:grid;gap:7px}.steps b{font-size:11px;color:#888}.steps span{font-size:12px;line-height:1.5;color:#777}
    @media(max-width:1000px){.hero{grid-template-columns:1fr}.workspace{grid-template-columns:1fr}.product-grid{grid-template-columns:repeat(3,1fr)}}
    @media(max-width:700px){.ai-page{padding-top:18px}.hero{padding:28px;border-radius:20px}.product-grid{grid-template-columns:repeat(2,1fr)}.section-head,.optimize{align-items:flex-start;flex-direction:column}.cart-total{text-align:left}.optimizer{width:100%}.optimizer input{flex:1}.steps{grid-template-columns:1fr 1fr}}
    @media(max-width:430px){.product-grid{grid-template-columns:1fr}.steps{grid-template-columns:1fr}.actions-row{flex-direction:column}}
  `]
})
export class AiShopComponent {
  private readonly ai = inject(AiShoppingService);
  private readonly cart = inject(CartService);

  prompt = '';
  newBudget = 50000;

  readonly examples = [
    '₹60,000 mein college + gaming setup chahiye.',
    '₹30,000 ka best phone chahiye.',
    '₹10,000 mein audio setup bana do.'
  ];

  readonly requirements = signal<ShoppingRequirements>({
    budget: null, category: null, intent: [], wantsGaming: false,
    wantsCollege: false, wantsPhone: false, wantsAudio: false, wantsFashion: false
  });

  readonly recommendations = signal<AgentRecommendation[]>([]);
  readonly lastPrompt = signal('');
  readonly response = signal('');

  readonly recommendedTotal = computed(() =>
    this.recommendations().reduce((sum, x) => sum + x.product.price, 0)
  );

  goalLabel = computed(() => {
    const r = this.requirements();
    if (r.wantsGaming && r.wantsCollege) return 'College + Gaming';
    if (r.wantsPhone) return 'Smartphone';
    if (r.wantsAudio) return 'Audio';
    if (r.wantsFashion) return 'Fashion';
    return r.category ?? 'General shopping';
  });

  useExample(example: string) {
    this.prompt = example;
    this.runAgent();
  }

  runAgent() {
    const text = this.prompt.trim();
    if (!text) return;
    const req = this.ai.parse(text);
    this.requirements.set(req);
    const recs = this.ai.recommend(req);
    const bundle = this.ai.buildSmartCart(req);
    this.recommendations.set(bundle.map(p => recs.find(r => r.product.id === p.id) ?? {
      product: p, score: 0, reason: 'Selected to fit the requested shopping goal.'
    }));
    this.lastPrompt.set(text);
    this.response.set(this.buildResponse(req, bundle));
    if (req.budget) this.newBudget = req.budget;
  }

  optimize() {
    const budget = Number(this.newBudget);
    if (!budget || budget < 1000) return;
    const req = { ...this.requirements(), budget };
    this.requirements.set(req);
    const bundle = this.ai.buildSmartCart(req);
    const ranked = this.ai.recommend(req);
    this.recommendations.set(bundle.map(p => ranked.find(r => r.product.id === p.id) ?? {
      product: p, score: 0, reason: 'Rebalanced to fit the new budget.'
    }));
    this.response.set(`Done — I rebuilt the recommendation for ₹${budget.toLocaleString('en-IN')} and kept the highest-value compatible items I could.`);
  }

  addRecommendedCart() {
    this.ai.applyProducts(this.recommendations().map(x => x.product));
    this.response.set('Done. I added the complete AI-selected setup to your cart.');
  }

  private buildResponse(req: ShoppingRequirements, products: Product[]) {
    const total = products.reduce((sum, p) => sum + p.price, 0);
    const budgetText = req.budget ? `₹${req.budget.toLocaleString('en-IN')}` : 'your budget';
    if (req.wantsGaming && req.wantsCollege) {
      return `I understood this as a college + gaming setup with a ${budgetText} ceiling. I prioritized a gaming laptop, then added useful gaming and campus accessories while keeping the bundle at ₹${total.toLocaleString('en-IN')}.`;
    }
    return `I found ${products.length} strong matches and built a ₹${total.toLocaleString('en-IN')} recommendation around ${budgetText}.`;
  }
}
