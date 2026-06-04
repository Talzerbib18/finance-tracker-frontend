import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Dashboard } from '../models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private apiUrl = 'http://localhost:8080/api/dashboard';

  constructor(private http: HttpClient) {}

  getDashboard(startDate?: string, endDate?: string): Observable<Dashboard> {
    let params = new HttpParams();
    if (startDate) params = params.set('startDate', startDate);
    if (endDate)   params = params.set('endDate', endDate);
    return this.http.get<Dashboard>(this.apiUrl, { params });
  }
}
