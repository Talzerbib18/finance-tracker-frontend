import { Component, OnInit, OnDestroy, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TransactionService } from '../../services/transaction.service';
import { Transaction } from '../../models/transaction.model';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

export interface MonthlyStats {
  month: string;
  label: string;
  income: number;
  expenses: number;
  net: number;
}

export interface CategoryStat {
  name: string;
  icon: string;
  color: string;
  amount: number;
  count: number;
  percent: number;
}

export interface DayStat {
  day: string;
  amount: number;
}

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stats.component.html',
  styleUrl: './stats.component.scss'
})
export class StatsComponent implements OnInit, OnDestroy {
  @ViewChild('netChart')  netChartRef!: ElementRef;
  @ViewChild('dayChart')  dayChartRef!: ElementRef;

  loading = true;
  transactions: Transaction[] = [];

  netChart: Chart | null = null;
  dayChart: Chart | null = null;

  monthlyStats: MonthlyStats[] = [];
  topCategories: CategoryStat[] = [];
  dayStats: DayStat[] = [];

  constructor(
    private transactionService: TransactionService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.transactionService.getAll().subscribe({
      next: (data) => {
        this.transactions = data;
        this.compute();
        this.loading = false;
        this.cdr.detectChanges();
        setTimeout(() => this.renderCharts(), 50);
      },
      error: () => { this.loading = false; }
    });
  }

  ngOnDestroy() {
    this.netChart?.destroy();
    this.dayChart?.destroy();
  }

  private compute() {
    this.monthlyStats  = this.computeMonthly();
    this.topCategories = this.computeTopCategories();
    this.dayStats      = this.computeDayOfWeek();
  }

  private computeMonthly(): MonthlyStats[] {
    const map = new Map<string, { income: number; expenses: number }>();
    this.transactions.forEach(t => {
      const m = (t.date || '').slice(0, 7);
      if (!m) return;
      if (!map.has(m)) map.set(m, { income: 0, expenses: 0 });
      const e = map.get(m)!;
      t.type === 'INCOME' ? (e.income += t.amount) : (e.expenses += t.amount);
    });

    return Array.from(map.entries())
      .map(([month, { income, expenses }]) => ({
        month,
        label: new Date(month + '-01').toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
        income,
        expenses,
        net: income - expenses
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12);
  }

  private computeTopCategories(): CategoryStat[] {
    const map = new Map<string, CategoryStat>();
    const expenses = this.transactions.filter(t => t.type === 'EXPENSE' && t.categoryName);
    const total = expenses.reduce((s, t) => s + t.amount, 0);

    expenses.forEach(t => {
      const key = t.categoryName!;
      if (!map.has(key)) map.set(key, { name: key, icon: t.categoryIcon || '', color: t.categoryColor || '#6366f1', amount: 0, count: 0, percent: 0 });
      const e = map.get(key)!;
      e.amount += t.amount;
      e.count++;
    });

    return Array.from(map.values())
      .map(c => ({ ...c, percent: total ? (c.amount / total) * 100 : 0 }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
  }

  private computeDayOfWeek(): DayStat[] {
    const labels = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    const totals = new Array(7).fill(0);

    this.transactions
      .filter(t => t.type === 'EXPENSE')
      .forEach(t => {
        const d = new Date(t.date + 'T00:00:00').getDay(); // 0=dim
        const idx = d === 0 ? 6 : d - 1; // convertir en lundi=0
        totals[idx] += t.amount;
      });

    return labels.map((day, i) => ({ day, amount: totals[i] }));
  }

  // ---- Computed stats ----

  get totalTransactions(): number { return this.transactions.length; }

  get totalExpenses(): number {
    return this.transactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
  }

  get totalIncome(): number {
    return this.transactions.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
  }

  get avgMonthlyExpense(): number {
    if (!this.monthlyStats.length) return 0;
    const months = this.monthlyStats.filter(m => m.expenses > 0);
    return months.length ? months.reduce((s, m) => s + m.expenses, 0) / months.length : 0;
  }

  get mostExpensiveMonth(): MonthlyStats | null {
    if (!this.monthlyStats.length) return null;
    return this.monthlyStats.reduce((max, m) => m.expenses > max.expenses ? m : max, this.monthlyStats[0]);
  }

  get bestMonth(): MonthlyStats | null {
    if (!this.monthlyStats.length) return null;
    return this.monthlyStats.reduce((max, m) => m.net > max.net ? m : max, this.monthlyStats[0]);
  }

  get busiestDay(): DayStat | null {
    if (!this.dayStats.length) return null;
    return this.dayStats.reduce((max, d) => d.amount > max.amount ? d : max, this.dayStats[0]);
  }

  get maxCategoryAmount(): number {
    return this.topCategories.length ? this.topCategories[0].amount : 1;
  }

  // ---- Charts ----

  private renderCharts() {
    this.renderNetChart();
    this.renderDayChart();
  }

  private renderNetChart() {
    if (!this.netChartRef || !this.monthlyStats.length) return;
    if (this.netChart) { this.netChart.destroy(); this.netChart = null; }

    const canvas = this.netChartRef.nativeElement as HTMLCanvasElement;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);

    const isDark = document.body.classList.contains('dark');
    const gridColor = isDark ? '#2a3350' : '#edf1f6';
    const textColor = isDark ? '#8b96ad' : '#94a3b8';

    this.netChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: this.monthlyStats.map(m => m.label),
        datasets: [
          {
            label: 'Revenus',
            data: this.monthlyStats.map(m => m.income),
            borderColor: '#10b981',
            backgroundColor: 'rgba(16,185,129,0.1)',
            borderWidth: 2.5,
            pointRadius: 4,
            pointBackgroundColor: '#10b981',
            fill: false,
            tension: 0.4
          },
          {
            label: 'Dépenses',
            data: this.monthlyStats.map(m => m.expenses),
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239,68,68,0.08)',
            borderWidth: 2.5,
            pointRadius: 4,
            pointBackgroundColor: '#ef4444',
            fill: false,
            tension: 0.4
          },
          {
            label: 'Solde net',
            data: this.monthlyStats.map(m => m.net),
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37,99,235,0.1)',
            borderWidth: 3,
            pointRadius: 5,
            pointBackgroundColor: '#2563eb',
            fill: true,
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 7, padding: 20, color: textColor } },
          tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label} : ${(ctx.parsed.y ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}` } }
        },
        scales: {
          x: { grid: { display: false }, border: { display: false }, ticks: { color: textColor } },
          y: { beginAtZero: true, border: { display: false }, grid: { color: gridColor }, ticks: { color: textColor, callback: v => v + ' €' } }
        }
      }
    });
  }

  private renderDayChart() {
    if (!this.dayChartRef || !this.dayStats.length) return;
    if (this.dayChart) { this.dayChart.destroy(); this.dayChart = null; }

    const canvas = this.dayChartRef.nativeElement as HTMLCanvasElement;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);

    const isDark = document.body.classList.contains('dark');
    const gridColor = isDark ? '#2a3350' : '#edf1f6';
    const textColor = isDark ? '#8b96ad' : '#94a3b8';

    const maxDay = Math.max(...this.dayStats.map(d => d.amount));

    this.dayChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: this.dayStats.map(d => d.day.slice(0, 3)),
        datasets: [{
          label: 'Dépenses',
          data: this.dayStats.map(d => d.amount),
          backgroundColor: this.dayStats.map(d =>
            d.amount === maxDay ? '#2563eb' : (isDark ? '#1c2438' : '#dbeafe')
          ),
          borderRadius: 8,
          borderSkipped: false,
          barPercentage: 0.65
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${(ctx.parsed.y ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}` } }
        },
        scales: {
          x: { grid: { display: false }, border: { display: false }, ticks: { color: textColor } },
          y: { beginAtZero: true, border: { display: false }, grid: { color: gridColor }, ticks: { color: textColor, callback: v => v + ' €' } }
        }
      }
    });
  }

  formatCurrency(v: number): string {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
  }

  formatMonth(m: string): string {
    return new Date(m + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }
}
