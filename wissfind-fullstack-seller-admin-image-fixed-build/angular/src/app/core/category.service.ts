import {Injectable,inject,signal} from '@angular/core';
import {BackendApiService} from './backend-api.service';
export interface CategoryDto{id:number;name:string;slug:string;parentName?:string|null;subcategories?:CategoryDto[]}
@Injectable({providedIn:'root'}) export class CategoryService{
 private api=inject(BackendApiService); readonly categories=signal<CategoryDto[]>([]);
 async load(signal?:AbortSignal){try{this.categories.set(await this.api.get<CategoryDto[]>('/categories/tree',signal)||[])}catch{}}
}
