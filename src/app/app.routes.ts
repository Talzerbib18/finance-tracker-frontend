import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { TransactionsComponent } from './components/transactions/transactions.component';
import { GoalsComponent } from './components/goals/goals.component';
import { CategoriesComponent } from './components/categories/categories.component';
import { StatsComponent } from './components/stats/stats.component';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard',    component: DashboardComponent },
  { path: 'transactions', component: TransactionsComponent },
  { path: 'goals',        component: GoalsComponent },
  { path: 'categories',   component: CategoriesComponent },
  { path: 'stats',        component: StatsComponent },
];
