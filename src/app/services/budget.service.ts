import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Budget } from '../models/budget.model';

@Injectable({ providedIn: 'root' })
export class BudgetService {
  private apiUrl = 'http://localhost:8080/api/budgets';

  constructor(private http: HttpClient) {}

  getAll(month: string): Observable<Budget[]> {
    const params = new HttpParams().set('month', month);
    return this.http.get<Budget[]>(this.apiUrl, { params });
  }

  create(budget: Budget): Observable<Budget> {
    return this.http.post<Budget>(this.apiUrl, budget);
  }

  update(id: number, budget: Budget): Observable<Budget> {
    return this.http.put<Budget>(`${this.apiUrl}/${id}`, budget);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
