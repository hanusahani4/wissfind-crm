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
    if (error instanceof HttpErrorResponse && error.status === 401) {
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
  upload<T>(path: string, formData: FormData, signal?: AbortSignal): Promise<T> {
    let headers = this.authHeaders();
    headers = headers.delete('Content-Type');
    return this.request(this.http.post<T>(`${this.baseUrl}${path}`, formData, { headers }), signal);
  }
}
