import { Injectable, inject, ApplicationRef } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom, fromEvent, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { SellerVariantDomBridge } from './seller-variant-dom-bridge';
import { ProductVariantDomBridge } from './product-variant-dom-bridge';
import { SellerVariantHelpBridge } from './seller-variant-help-bridge';
import { VariantUxBridge } from './variant-ux-bridge';
import { HomeVariantCardBridge } from './home-variant-card-bridge';

@Injectable({ providedIn: 'root' })
export class BackendApiService {
  private readonly http = inject(HttpClient);
  private readonly appRef = inject(ApplicationRef);
  private readonly router = inject(Router);
  private sessionLogoutStarted = false;
  readonly baseUrl =
    typeof window !== 'undefined' && window.location.hostname === 'localhost' && window.location.port === '4200'
      ? 'http://localhost:8080/api'
      : '/api';

  constructor() {
    SellerVariantDomBridge.install();
    ProductVariantDomBridge.install();
    SellerVariantHelpBridge.install();
    VariantUxBridge.install();
    HomeVariantCardBridge.install();
  }

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('wissfind_jwt');
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  private refreshView(): void {
    setTimeout(() => { try { this.appRef.tick(); } catch {} }, 0);
  }

  private handleError(error: unknown): never {
    if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
      this.expireSession();
    }
    throw error;
  }

  private expireSession(): void {
    if (this.sessionLogoutStarted || typeof localStorage === 'undefined') return;
    const token = localStorage.getItem('wissfind_jwt');
    if (!token) return;
    this.sessionLogoutStarted = true;
    localStorage.removeItem('wissfind_jwt');
    localStorage.removeItem('wissfind_user');
    try {
      window.dispatchEvent(new CustomEvent('wissfind-session-expired'));
    } catch {}
    const currentUrl = this.router.url || '/';
    if (!currentUrl.startsWith('/login')) {
      void this.router.navigate(['/login'], {
        queryParams: { returnUrl: currentUrl, sessionExpired: '1' }
      }).finally(() => { this.sessionLogoutStarted = false; });
    } else {
      this.sessionLogoutStarted = false;
    }
  }

  private request<T>(source: Observable<T>, signal?: AbortSignal): Promise<T> {
    const fail = (e: unknown): never => {
      this.refreshView();
      return this.handleError(e);
    };
    if (!signal) return firstValueFrom(source).then(v => { this.refreshView(); return v; }, fail);
    if (signal.aborted) { this.refreshView(); return Promise.reject(new DOMException('Request aborted', 'AbortError')); }
    return firstValueFrom(source.pipe(takeUntil(fromEvent(signal, 'abort')))).then(v => { this.refreshView(); return v; }, fail);
  }

  get<T>(path: string, signal?: AbortSignal): Promise<T> { return this.request(this.http.get<T>(`${this.baseUrl}${path}`, { headers: this.authHeaders() }), signal); }
  post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> { return this.request(this.http.post<T>(`${this.baseUrl}${path}`, body, { headers: this.authHeaders() }), signal); }
  put<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> { return this.request(this.http.put<T>(`${this.baseUrl}${path}`, body, { headers: this.authHeaders() }), signal); }
  patch<T>(path: string, body: unknown = {}, params?: Record<string, string | number>, signal?: AbortSignal): Promise<T> { return this.request(this.http.patch<T>(`${this.baseUrl}${path}`, body, { headers: this.authHeaders(), params }), signal); }
  delete<T = void>(path: string, signal?: AbortSignal): Promise<T> { return this.request(this.http.delete<T>(`${this.baseUrl}${path}`, { headers: this.authHeaders() }), signal); }
  getBlob(path: string, signal?: AbortSignal): Promise<Blob> { return this.request(this.http.get(`${this.baseUrl}${path}`, { headers: this.authHeaders(), responseType: 'blob' }), signal); }

  /**
   * Production nginx currently rejects large multipart bodies before they reach
   * Spring. Keep a single image <= 600 KB and keep multi-image requests below
   * ~850 KB total. Compression happens only when Save actually uploads; file
   * selection itself never sends a network request.
   */
  async upload<T>(path: string, formData: FormData, signal?: AbortSignal): Promise<T> {
    const prepared = await this.prepareImageUpload(formData);
    let headers = this.authHeaders();
    headers = headers.delete('Content-Type');
    return this.request(this.http.post<T>(`${this.baseUrl}${path}`, prepared, { headers }), signal);
  }

  private async prepareImageUpload(formData: FormData): Promise<FormData> {
    const entries = Array.from(formData.entries());
    const imageFiles = entries.filter(([, value]) => value instanceof File && value.type.startsWith('image/')) as [string, File][];
    if (!imageFiles.length) return formData;

    const totalBudget = 850 * 1024;
    const perImageBudget = Math.min(600 * 1024, Math.floor(totalBudget / imageFiles.length));
    const prepared = new FormData();
    let imageIndex = 0;

    for (const [name, value] of entries) {
      if (value instanceof File && value.type.startsWith('image/')) {
        const compressed = await this.compressImage(value, perImageBudget);
        prepared.append(name, compressed, compressed.name);
        imageIndex++;
      } else {
        prepared.append(name, value);
      }
    }

    void imageIndex;
    return prepared;
  }

  private async compressImage(file: File, maxBytes: number): Promise<File> {
    // GIFs can contain animation; don't flatten them into a single frame.
    if (file.type === 'image/gif' || file.size <= maxBytes) return file;

    const bitmap = await createImageBitmap(file);
    try {
      const maxDimension = 1600;
      const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: true });
      if (!ctx) return file;
      ctx.drawImage(bitmap, 0, 0, width, height);

      let quality = 0.82;
      let blob = await this.canvasBlob(canvas, quality);
      while (blob.size > maxBytes && quality > 0.35) {
        quality -= 0.07;
        blob = await this.canvasBlob(canvas, quality);
      }

      // If quality alone is not enough, progressively reduce dimensions.
      let currentCanvas = canvas;
      while (blob.size > maxBytes && currentCanvas.width > 640) {
        const next = document.createElement('canvas');
        next.width = Math.max(640, Math.round(currentCanvas.width * 0.8));
        next.height = Math.max(480, Math.round(currentCanvas.height * 0.8));
        const nextCtx = next.getContext('2d', { alpha: true });
        if (!nextCtx) break;
        nextCtx.drawImage(currentCanvas, 0, 0, next.width, next.height);
        currentCanvas = next;
        quality = Math.max(0.45, quality);
        blob = await this.canvasBlob(currentCanvas, quality);
      }

      if (blob.size >= file.size || blob.size > maxBytes) return file;
      const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
      return new File([blob], `${baseName}.webp`, { type: 'image/webp', lastModified: file.lastModified });
    } finally {
      bitmap.close();
    }
  }

  private canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Unable to compress image')), 'image/webp', quality);
    });
  }
}
