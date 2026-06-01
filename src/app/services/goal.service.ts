import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SavingsGoal } from '../models/goal.model';

@Injectable({ providedIn: 'root' })
export class GoalService {
  private apiUrl = 'http://localhost:8080/api/goals';

  constructor(private http: HttpClient) {}

  getAll(): Observable<SavingsGoal[]> {
    return this.http.get<SavingsGoal[]>(this.apiUrl);
  }

  create(goal: SavingsGoal): Observable<SavingsGoal> {
    return this.http.post<SavingsGoal>(this.apiUrl, goal);
  }

  update(id: number, goal: SavingsGoal): Observable<SavingsGoal> {
    return this.http.put<SavingsGoal>(`${this.apiUrl}/${id}`, goal);
  }

  contribute(id: number, amount: number): Observable<SavingsGoal> {
    return this.http.post<SavingsGoal>(`${this.apiUrl}/${id}/contribute`, { amount });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
