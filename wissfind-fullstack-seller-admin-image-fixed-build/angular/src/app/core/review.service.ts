import { Injectable, ApplicationRef } from '@angular/core';
import { BackendApiService } from './backend-api.service';

export interface ProductReview {
  id:any; productId:string; author:string; rating:number; title:string; text:string;
  date:string; likes:number; likedByMe?:boolean;
}

export interface ReviewEligibility {
  canReview:boolean; purchased:boolean; alreadyReviewed:boolean;
}

@Injectable({providedIn:'root'})
export class ReviewService {
  private likes=new Set<string>();
  private eligibilityStyle?:HTMLStyleElement;

  constructor(private api:BackendApiService, private appRef:ApplicationRef){}

  async getReviews(productId:string|number, signal?:AbortSignal):Promise<ProductReview[]> {
    const id=String(productId);
    this.hideReviewFormUntilEligibilityKnown();
    let result:ProductReview[]=[];
    try {
      // Reviews and eligibility are independent requests. Run them together
      // so product-detail rendering is not delayed by a network waterfall.
      const [rowsResult] = await Promise.all([
        this.api.get(`/reviews/product/${id}`, signal),
        this.getEligibility(id,signal)
      ]);
      const rows:any[]=Array.isArray(rowsResult)?rowsResult:[];
      result=rows.map(r=>({...r,id:String(r.id),productId:String(r.productId),date:r.date?new Date(r.date).toLocaleDateString('en-IN'):'',likedByMe:this.likes.has(String(r.id))}));
    } catch {
      // Keep the detail page usable even when reviews/eligibility fail.
    }
    setTimeout(() => { try { this.appRef.tick(); } catch {} }, 0);
    return result;
  }

  async getEligibility(productId:string|number, signal?:AbortSignal):Promise<ReviewEligibility> {
    const id=String(productId);
    try {
      const result:any=await this.api.get(`/reviews/product/${id}/eligibility`, signal);
      const eligibility:ReviewEligibility={canReview:!!result?.canReview,purchased:!!result?.purchased,alreadyReviewed:!!result?.alreadyReviewed};
      this.applyEligibilityToForm(eligibility);
      return eligibility;
    } catch {
      const eligibility:ReviewEligibility={canReview:false,purchased:false,alreadyReviewed:false};
      this.applyEligibilityToForm(eligibility);
      return eligibility;
    }
  }

  private hideReviewFormUntilEligibilityKnown(){
    if(typeof document==='undefined'||this.eligibilityStyle) return;
    this.eligibilityStyle=document.createElement('style');
    document.head.appendChild(this.eligibilityStyle);
    this.eligibilityStyle.textContent='.write-review{display:none!important}.review-layout{grid-template-columns:minmax(0,1fr)!important}@media(max-width:700px){.review-layout{grid-template-columns:1fr!important}.write-review{position:static!important}}';
  }

  private applyEligibilityToForm(eligibility:ReviewEligibility){
    if(typeof document==='undefined'||!this.eligibilityStyle) return;
    const mobile='@media(max-width:700px){.review-layout{grid-template-columns:1fr!important}.write-review{position:static!important}}';
    this.eligibilityStyle.textContent=eligibility.canReview
      ? `.review-layout{grid-template-columns:minmax(0,1.5fr) minmax(300px,.7fr)}${mobile}`
      : `.write-review{display:none!important}.review-layout{grid-template-columns:minmax(0,1fr)!important}${mobile}`;
  }

  async addReview(review:Omit<ProductReview,'id'|'date'|'likes'>):Promise<any>;
  async addReview(productId:string|number, review:{rating:number;title:string;text:string}):Promise<any>;
  async addReview(first:Omit<ProductReview,'id'|'date'|'likes'>|string|number, second?:{rating:number;title:string;text:string}) {
    const review=typeof first==='object'
      ? first
      : {productId:String(first),rating:second?.rating||0,title:second?.title||'',text:second?.text||''};
    const r:any=await this.api.post(`/reviews/product/${review.productId}`,{rating:review.rating,title:review.title,text:review.text});
    return r.review;
  }

  async toggleReviewLike(reviewId:string|number) {
    const id=String(reviewId);
    if(this.likes.has(id)) return false;
    try { await this.api.patch(`/reviews/${id}/like`,{}); this.likes.add(id); return true; }
    catch { return false; }
  }

  isReviewLiked(reviewId:string|number){return this.likes.has(String(reviewId));}
  getProductLikeCount(_productId:string|number){return 0;}
  isProductLiked(_productId:string|number){return false;}
  toggleProductLike(_productId:string|number){return false;}
}