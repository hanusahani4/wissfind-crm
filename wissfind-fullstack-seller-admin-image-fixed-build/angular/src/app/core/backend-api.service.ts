import { Injectable, inject, ApplicationRef } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom, fromEvent, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class BackendApiService {
  private readonly http = inject(HttpClient);
  private readonly appRef = inject(ApplicationRef);
  readonly baseUrl =
    typeof window !== 'undefined' && window.location.hostname === 'localhost' && window.location.port === '4200'
      ? 'http://localhost:8080/api'
      : '/api';

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('wissfind_jwt');
    return token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : new HttpHeaders();
  }

  /**
   * Refresh the application after an awaited HTTP promise has returned to the
   * calling component. A macrotask is intentional here: Promise callbacks
   * and async/await continuations are microtasks, so scheduling the tick with
   * setTimeout guarantees that ProductDetailComponent has already assigned
   * the loaded product before the view is checked.
   */
  private refreshView(): void {
    setTimeout(() => {
      try {
        this.appRef.tick();
      } catch {
        // Never turn a successful API response into an application error just
        // because a manual view refresh was not possible.
      }
    }, 0);
  }

  private request<T>(source: Observable<T>, signal?: AbortSignal): Promise<T> {
    if (!signal) {
      return firstValueFrom(source).then(
        value => {
          this.refreshView();
          return value;
        },
        error => {
          this.refreshView();
          throw error;
        }
      );
    }

    if (signal.aborted) {
      this.refreshView();
      return Promise.reject(new DOMException('Request aborted', 'AbortError'));
    }

    return firstValueFrom(source.pipe(takeUntil(fromEvent(signal, 'abort')))).then(
      value => {
        this.refreshView();
        return value;
      },
      error => {
        this.refreshView();
        throw error;
      }
    );
  }

  get<T>(path: string, signal?: AbortSignal): Promise<T> {
    return this.request(this.http.get<T>(`${this.baseUrl}${path}`, {
      headers: this.authHeaders()
    }), signal);
  }

  post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
    return this.request(this.http.post<T>(`${this.baseUrl}${path}`, body, {
      headers: this.authHeaders()
    }), signal);
  }

  put<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
    return this.request(this.http.put<T>(`${this.baseUrl}${path}`, body, {
      headers: this.authHeaders()
    }), signal);
  }

  patch<T>(
    path: string,
    body: unknown = {},
    params?: Record<string, string | number>,
    signal?: AbortSignal
  ): Promise<T> {
    return this.request(this.http.patch<T>(`${this.baseUrl}${path}`, body, {
      headers: this.authHeaders(),
      params
    }), signal);
  }

  delete<T = void>(path: string, signal?: AbortSignal): Promise<T> {
    return this.request(this.http.delete<T>(`${this.baseUrl}${path}`, {
      headers: this.authHeaders()
    }), signal);
  }

  getBlob(path: string, signal?: AbortSignal): Promise<Blob> {
    return this.request(this.http.get(`${this.baseUrl}${path}`, {
      headers: this.authHeaders(),
      responseType: 'blob'
    }), signal);
  }

  upload<T>(path: string, formData: FormData, signal?: AbortSignal): Promise<T> {
    let headers = this.authHeaders();
    headers = headers.delete('Content-Type');

    return this.request(this.http.post<T>(`${this.baseUrl}${path}`, formData, {
      headers
    }), signal);
  }
}
