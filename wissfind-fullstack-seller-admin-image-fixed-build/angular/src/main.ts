import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(
      routes,
      withInMemoryScrolling({
        // Every Angular route navigation starts at the top.
        // Do not restore the previous page's scroll position.
        scrollPositionRestoration: 'top',
        anchorScrolling: 'disabled'
      })
    ),
    provideHttpClient()
  ]
}).catch(console.error);
