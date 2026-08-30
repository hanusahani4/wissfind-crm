import { Injectable } from '@angular/core';
import { BackendApiService } from './backend-api.service';

export interface ProductReview {
  id:string; productId:string; author:string; rating:number; title:string; text:string;
  date:string; likes:number; likedByMe?:boolean;
}

@Injectable({providedIn:'root'})
export class ReviewService {
  private likes=new Set<string>();

  constructor(private api:BackendApiService){}

  async getReviews(productId:string, signal?:AbortSignal):Promise<ProductReview[]> {
    try {
      const rows:any[]=await this.api.get(`/reviews/product/${productId}`, signal);
      return rows.map(r=>({...r,id:String(r.id),productId:String(r.productId),
        date:r.date?new Date(r.date).toLocaleDateString('en-IN'):'',likedByMe:this.likes.has(String(r.id))}));
    } catch { return []; }
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
  async getProductLikeCount(_productId:string){return 0;}
  isProductLiked(_productId:string){return false;}
  async toggleProductLike(_productId:string){return false;}
}
