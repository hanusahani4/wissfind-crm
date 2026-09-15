import { Injectable, ApplicationRef } from '@angular/core';
import { BackendApiService } from './backend-api.service';

export interface ProductReview {
  id:string; productId:string; author:string; rating:number; title:string; text:string;
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

  async getReviews(productId:string, signal?:AbortSignal):Promise<ProductReview[]> {
    this.hideReviewFormUntilEligibilityKnown();
    try {
      const rows:any[]=await this.api.get(`/reviews/product/${productId}`, signal);
      const result = rows.map(r=>({...r,id:String(r.id),productId:String(r.productId),
        date:r.date?new Date(r.date).toLocaleDateString('en-IN'):'',likedByMe:this.likes.has(String(r.id))}));
      setTimeout(() => { try { this.appRef.tick(); } catch {} }, 0);
      return result;
    } catch { return []; }
  }

  async getEligibility(productId:string, signal?:AbortSignal):Promise<ReviewEligibility> {
    try {
      const result:any=await this.api.get(`/reviews/product/${productId}/eligibility`, signal);
      const eligibility:ReviewEligibility={
        canReview:!!result?.canReview,
        purchased:!!result?.purchased,
        alreadyReviewed:!!result?.alreadyReviewed
      };
      this.applyEligibilityToForm(eligibility);
      return eligibility;
    } catch {
      const eligibility:ReviewEligibility={canReview:false,purchased:false,alreadyReviewed:false};
      this.applyEligibilityToForm(eligibility);
      return eligibility;
    }
  }

  private hideReviewFormUntilEligibilityKnown(){
    if(typeof document==='undefined') return;
    if(this.eligibilityStyle) return;
    this.eligibilityStyle=document.createElement('style');
    this.eligibilityStyle.textContent='.write-review{display:none!important}.review-layout{grid-template-columns:minmax(0,1fr)!important}';
    document.head.appendChild(this.eligibilityStyle);
  }

  private applyEligibilityToForm(eligibility:ReviewEligibility){
    if(typeof document==='undefined') return;
    if(!this.eligibilityStyle) return;
    this.eligibilityStyle.textContent=eligibility.canReview
      ? '.review-layout{grid-template-columns:minmax(0,1.5fr) minmax(300px,.7fr)}'
      : '.write-review{display:none!important}.review-layout{grid-template-columns:minmax(0,1fr)!important}';
  }

  async addReview(review:Omit<ProductReview,'id'|'date'|'likes'>) {
    const r:any=await this.api.post(`/reviews/product/${review.productId}`,{
      rating:review.rating,title:review.title,text:review.text
    });
    return r.review;
  }

  async toggleReviewLike(reviewId:string) {
    if(this.likes.has(reviewId)) return false;
    try { await this.api.patch(`/reviews/${reviewId}/like`,{}); this.likes.add(reviewId); return true; }
    catch { return false; }
  }

  isReviewLiked(reviewId:string){return this.likes.has(reviewId);}
  getProductLikeCount(_productId:string){return 0;}
  isProductLiked(_productId:string){return false;}
  toggleProductLike(_productId:string){return false;}
}
