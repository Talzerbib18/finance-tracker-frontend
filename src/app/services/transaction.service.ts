import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Transaction, TransactionFilter } from '../models/transaction.model';

@Injectable({ providedIn: 'root' })
export class TransactionService {
  private apiUrl = 'http://localhost:8080/api/transactions';

  constructor(private http: HttpClient) {}

  getAll(filter?: TransactionFilter): Observable<Transaction[]> {
    let params = new HttpParams();
    if (filter) {
      if (filter.type) params = params.set('type', filter.type);
      if (filter.categoryId) params = params.set('categoryId', filter.categoryId.toString());
      if (filter.startDate) params = params.set('startDate', filter.startDate);
      if (filter.endDate) params = params.set('endDate', filter.endDate);
      if (filter.minAmount != null) params = params.set('minAmount', filter.minAmount.toString());
      if (filter.maxAmount != null) params = params.set('maxAmount', filter.maxAmount.toString());
      if (filter.search) params = params.set('search', filter.search);
    }
    return this.http.get<Transaction[]>(this.apiUrl, { params });
  }

  getById(id: number): Observable<Transaction> {
    return this.http.get<Transaction>(`${this.apiUrl}/${id}`);
  }

  create(transaction: Transaction): Observable<Transaction> {
    return this.http.post<Transaction>(this.apiUrl, transaction);
  }

  update(id: number, transaction: Transaction): Observable<Transaction> {
    return this.http.put<Transaction>(`${this.apiUrl}/${id}`, transaction);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
