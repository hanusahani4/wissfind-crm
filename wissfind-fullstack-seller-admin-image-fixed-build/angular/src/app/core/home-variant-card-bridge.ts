export class HomeVariantCardBridge {
  private static installed=false;
  private static pending=new Set<string>();
  private static variantCache=new Map<string,{at:number;data:any[]}>();
  private static readonly cacheTtl=5*60*1000;
  private static cardObserver?:IntersectionObserver;

  static install():void{
    if(this.installed||typeof window==='undefined'||typeof document==='undefined')return;
    this.installed=true;
    document.addEventListener('click',e=>this.handleAdd(e),true);
    const run=()=>this.decorateCards();
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
    // Watch DOM changes only; variant API calls are limited to cards near the viewport.
    const observer=new MutationObserver(()=>window.setTimeout(()=>this.decorateCards(),80));
    observer.observe(document.body,{childList:true,subtree:true});
  }

  private static handleAdd(event:Event){
    const target=event.target as HTMLElement|null;
    const button=target?.closest('.product-card .add-cart') as HTMLButtonElement|null;
    if(!button||!button.dataset['variantSku'])return;
    const stock=Number(button.dataset['variantStock']||0);
    if(stock<=0){event.preventDefault();event.stopImmediatePropagation();return;}
    const card=button.closest('.product-card') as HTMLElement|null;
    const id=button.dataset['variantProductId'];
    if(!card||!id)return;
    event.preventDefault();event.stopImmediatePropagation();
    try{
      const old=localStorage.getItem('wissfind-cart');
      const parsed=JSON.parse(old||'[]');
      const items=Array.isArray(parsed)?parsed:[];
      const variant={color:button.dataset['variantColor']||'',size:button.dataset['variantSize']||'',sku:button.dataset['variantSku']||'',price:Number(button.dataset['variantPrice']||0),oldPrice:Number(button.dataset['variantOldPrice']||0),image:button.dataset['variantImage']||'',stock};
      const key=`${id}::${variant.sku||`${variant.color}|${variant.size}`}`;
      const found=items.find((x:any)=>`${x?.product?.id}::${x?.variant?.sku||`${x?.variant?.color||''}|${x?.variant?.size||''}`}`===key);
      if(found)found.quantity=Math.max(1,Number(found.quantity||0)+1);
      else items.push({product:{id,name:card.querySelector('h3')?.textContent?.trim()||'Product',category:card.querySelector('.meta span')?.textContent?.split('·')?.[0]?.trim()||'',price:variant.price,oldPrice:variant.oldPrice,image:variant.image||'',stock},quantity:1,variant});
      localStorage.setItem('wissfind-cart',JSON.stringify(items));
      window.location.href='/cart';
    }catch{}
  }

  private static decorateCards(){
    if(location.pathname!=='/')return;
    const cards=Array.from(document.querySelectorAll('.product-card')) as HTMLElement[];
    if(!cards.length)return;
    if('IntersectionObserver' in window){
      if(!this.cardObserver){
        this.cardObserver=new IntersectionObserver(entries=>{
          entries.forEach(entry=>{
            if(!entry.isIntersecting)return;
            const card=entry.target as HTMLElement;
            const link=card.querySelector('.image-wrap') as HTMLAnchorElement|null;
            const image=link?.querySelector('img') as HTMLImageElement|null;
            const productId=link?this.productIdFromHref(link.href):'';
            if(productId&&image&&!this.pending.has(productId)&&card.dataset['variantCardDecorated']!=='1'){
              this.pending.add(productId);
              void this.applyVariant(card,productId).finally(()=>this.pending.delete(productId));
            }
            this.cardObserver?.unobserve(card);
          });
        },{rootMargin:'500px 0px'});
      }
      cards.forEach(card=>{
        if(card.dataset['variantCardDecorated']==='1')return;
        // Backend already selected the customer-facing variant in /products/paged.
        // Do not hide the image or make a per-card /variants request.
        if(card.dataset['variantServer']==='true'){
          card.dataset['variantCardDecorated']='1';
          return;
        }
        const link=card.querySelector('.image-wrap') as HTMLAnchorElement|null;
        if(link){
          // Do not flash the parent image before the variant request resolves.
          // The card keeps its layout while the image is temporarily hidden.
          card.dataset['variantPending']='1';
          const image=link.querySelector('img') as HTMLImageElement|null;
          if(image)image.style.visibility='hidden';
          this.cardObserver?.observe(card);
        }
      });
      return;
    }
    // Fallback: only decorate the first viewport-sized batch.
    cards.slice(0,8).forEach(card=>{
      if(card.dataset['variantServer']==='true'){card.dataset['variantCardDecorated']='1';return;}
      const link=card.querySelector('.image-wrap') as HTMLAnchorElement|null;
      const image=link?.querySelector('img') as HTMLImageElement|null;
      const productId=link?this.productIdFromHref(link.href):'';
      if(productId&&image&&!this.pending.has(productId)&&card.dataset['variantCardDecorated']!=='1'){
        card.dataset['variantPending']='1';
        image.style.visibility='hidden';
        this.pending.add(productId);void this.applyVariant(card,productId).finally(()=>this.pending.delete(productId));
      }
    });
  }

  private static revealImage(card:HTMLElement){
    const image=card.querySelector('.image-wrap img') as HTMLImageElement|null;
    if(image)image.style.visibility='';
    delete card.dataset['variantPending'];
  }

  private static async applyVariant(card:HTMLElement,productId:string){
    try{
      const variants=await this.getVariants(productId);
      if(!variants.length){card.dataset['variantCardDecorated']='1';this.revealImage(card);return;}
      const normalized=variants.map((v:any)=>({color:String(v?.color??v?.name??'').trim(),images:Array.isArray(v?.images)?v.images.map((x:any)=>String(x??'')).filter(Boolean):[],sizes:Array.isArray(v?.sizes)?v.sizes.map((s:any)=>({size:String(s?.size??s?.name??'').trim(),sku:String(s?.sku??'').trim(),price:Number(s?.price??0),oldPrice:Number(s?.oldPrice??s?.mrp??0),stock:Math.max(0,Number(s?.stock??0))})).filter((s:any)=>s.size):[]})).filter((v:any)=>v.color&&v.sizes.length);
      if(!normalized.length){card.dataset['variantCardDecorated']='1';this.revealImage(card);return;}
      const selected=normalized.find((v:any)=>this.hasAvailableStock(v));
      if(!selected){card.dataset['variantCardDecorated']='1';this.revealImage(card);return;}
      const selectedSize=selected.sizes.find((s:any)=>s.stock>0);
      if(!selectedSize){card.dataset['variantCardDecorated']='1';this.revealImage(card);return;}
      const totalStock=normalized.reduce((a:number,v:any)=>a+v.sizes.reduce((b:number,s:any)=>b+Math.max(0,Number(s.stock||0)),0),0);
      card.dataset['variantTotalStock']=String(totalStock);
      const image=card.querySelector('.image-wrap img') as HTMLImageElement|null;
      if(image&&selected.images[0])image.src=this.absoluteUrl(selected.images[0]);
      const price=card.querySelector('.price strong') as HTMLElement|null;
      const oldPrice=card.querySelector('.price del') as HTMLElement|null;
      if(price)price.textContent=`₹${selectedSize.price.toLocaleString('en-IN')}`;
      if(oldPrice){if(selectedSize.oldPrice>selectedSize.price){oldPrice.textContent=`₹${selectedSize.oldPrice.toLocaleString('en-IN')}`;oldPrice.style.display='';}else oldPrice.style.display='none';}
      else if(selectedSize.oldPrice>selectedSize.price){const box=card.querySelector('.price') as HTMLElement|null;if(box){const del=document.createElement('del');del.textContent=`₹${selectedSize.oldPrice.toLocaleString('en-IN')}`;box.appendChild(del);}}
      const sale=card.querySelector('.sale') as HTMLElement|null;
      if(selectedSize.oldPrice>selectedSize.price&&!sale){const wrap=card.querySelector('.image-wrap');if(wrap){const badge=document.createElement('span');badge.className='sale';badge.textContent='SALE';wrap.appendChild(badge);}}
      const meta=card.querySelector('.meta') as HTMLElement|null;
      if(meta){meta.querySelector('.variant-summary')?.remove();const summary=document.createElement('span');summary.className='variant-summary';summary.textContent=`${selected.color} · ${selectedSize.size}`;summary.title=`Shown variant: ${selected.color}, ${selectedSize.size}, SKU ${selectedSize.sku||'—'}, total stock ${totalStock}`;summary.style.cssText='font-size:10px;text-transform:none;letter-spacing:0;color:#666;font-weight:700;margin-left:8px;white-space:nowrap;';meta.insertBefore(summary,meta.querySelector('.card-rating'));}
      const add=card.querySelector('.add-cart') as HTMLButtonElement|null;
      if(add){add.disabled=totalStock<=0;add.textContent=totalStock>0?'Add to cart':'Out of stock';add.dataset['variantProductId']=productId;add.dataset['variantColor']=selected.color;add.dataset['variantSize']=selectedSize.size;add.dataset['variantSku']=selectedSize.sku;add.dataset['variantPrice']=String(selectedSize.price);add.dataset['variantOldPrice']=String(selectedSize.oldPrice);add.dataset['variantStock']=String(selectedSize.stock);add.dataset['variantImage']=this.absoluteUrl(selected.images[0]||'');}
      card.dataset['variantCardDecorated']='1';
      this.revealImage(card);
    }catch{card.dataset['variantCardDecorated']='1';this.revealImage(card);}
  }

  private static hasAvailableStock(v:any){return Array.isArray(v?.sizes)&&v.sizes.some((s:any)=>Number(s?.stock??0)>0)}

  private static async getVariants(id:string){
    const cached=this.variantCache.get(id);
    if(cached&&Date.now()-cached.at<this.cacheTtl)return cached.data;
    const r=await fetch(`${this.baseUrl()}/products/${encodeURIComponent(id)}/variants`,{headers:this.authHeaders()});
    if(!r.ok)return[];
    const d=await r.json();
    const data=Array.isArray(d)?d:(Array.isArray(d?.content)?d.content:(Array.isArray(d?.variants)?d.variants:[]));
    this.variantCache.set(id,{at:Date.now(),data});
    return data;
  }

  private static productIdFromHref(href:string){try{const u=new URL(href,window.location.origin);const m=u.pathname.match(/^\/product\/([^/?#]+)/);return m?decodeURIComponent(m[1]):'';}catch{return''}}
  private static absoluteUrl(url:string){if(!url)return'';if(/^https?:\/\//i.test(url))return url;return`${this.baseUrl().replace(/\/api$/,'')}/${url.replace(/^\/+/, '')}`;}
  private static authHeaders():Record<string,string>{const t=localStorage.getItem('wissfind_jwt');return t?{Authorization:`Bearer ${t}`}:{ };}
  private static baseUrl(){return typeof window!=='undefined'&&window.location.hostname==='localhost'&&window.location.port==='4200'?'http://localhost:8080/api':'/api';}
}