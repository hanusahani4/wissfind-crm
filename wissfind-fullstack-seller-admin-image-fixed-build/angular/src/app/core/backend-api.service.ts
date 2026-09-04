import { Injectable, inject, ApplicationRef } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom, fromEvent, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class BackendApiService {
  private readonly http = inject(HttpClient);
  private readonly appRef = inject(ApplicationRef);
  readonly baseUrl = 'http://localhost:8080/api';

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('wissfind_jwt');
    return token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : new HttpHeaders();
  }

  /**
   * Angular 22 is using zoneless change detection in this application.
   * API promises can therefore complete without automatically refreshing
   * templates that are driven by ordinary component fields. Trigger one
   * application refresh after every API completion so async state changes
   * are reflected consistently across the customer/admin/seller screens.
   */
  private refreshView(): void {
    queueMicrotask(() => {
      try {
        this.appRef.tick();
      } catch {
        // Ignore a refresh error; the original API result must not be changed.
      }
    });
  }

  /**
   * Every request can be cancelled by the page that created it.
   * This is important when navigating away from a slow page.
   */
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

  /**
   * Upload multipart/form-data.
   * Do NOT set Content-Type here; the browser must add the boundary.
   */
  upload<T>(path: string, formData: FormData, signal?: AbortSignal): Promise<T> {
    let headers = this.authHeaders();
    headers = headers.delete('Content-Type');

    return this.request(this.http.post<T>(`${this.baseUrl}${path}`, formData, {
      headers
    }), signal);
  }
}
