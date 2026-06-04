import { Component, OnInit, OnDestroy, ElementRef, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DashboardService } from '../../services/dashboard.service';
import { BudgetService } from '../../services/budget.service';
import { CategoryService } from '../../services/category.service';
import { Dashboard } from '../../models/dashboard.model';
import { Budget, BudgetWithUsage } from '../../models/budget.model';
import { Category } from '../../models/category.model';
import { Chart, registerables } from 'chart.js';
import { SelectOnFocusDirective } from '../../directives/select-on-focus.directive';

Chart.register(...registerables);

type Preset = 'month' | 'last-month' | '7days' | 'custom';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SelectOnFocusDirective],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {
  @ViewChild('barChart') barChartRef!: ElementRef;
  @ViewChild('pieChart') pieChartRef!: ElementRef;

  dashboard: Dashboard | null = null;
  loading = true;
  barChart: Chart | null = null;
  pieChart: Chart | null = null;
  categoryExpenses: { name: string; amount: number; color: string }[] = [];

  // ---- Sélecteur de période ----
  showPeriodPicker = false;
  selectedPreset: Preset = 'month';
  customStart = '';
  customEnd = '';
  periodStart = '';
  periodEnd = '';

  // ---- Budgets ----
  budgets: BudgetWithUsage[] = [];
  categories: Category[] = [];
  showBudgetModal = false;
  editingBudget: Budget | null = null;
  budgetForm: Partial<Budget> = {};
  deleteBudgetId: number | null = null;

  constructor(
    private dashboardService: DashboardService,
    private budgetService: BudgetService,
    private categoryService: CategoryService
  ) {}

  // ---- Budget methods ----

  private currentMonthStr(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  loadBudgets() {
    const month = this.currentMonthStr();
    this.budgetService.getAll(month).subscribe({
      next: (budgets) => {
        this.budgets = budgets.map(b => this.enrichBudget(b));
      },
      error: () => {} // backend pas encore prêt
    });
  }

  private enrichBudget(b: Budget): BudgetWithUsage {
    const spent = b.spentAmount ?? this.getSpentForCategory(b.categoryName || '');
    const pct   = b.limitAmount > 0 ? (spent / b.limitAmount) * 100 : 0;
    return {
      ...b,
      spentAmount:  spent,
      usagePercent: Math.min(pct, 100),
      remaining:    Math.max(0, b.limitAmount - spent),
      status:       pct >= 100 ? 'exceeded' : pct >= 80 ? 'warning' : 'safe'
    };
  }

  private getSpentForCategory(name: string): number {
    return this.dashboard?.expensesByCategory?.[name] ?? 0;
  }

  onBudgetCategoryChange(categoryId: number) {
    const cat = this.categories.find(c => c.id === categoryId);
    this.budgetForm.categoryName  = cat?.name;
    this.budgetForm.categoryIcon  = cat?.icon;
    this.budgetForm.categoryColor = cat?.color;
  }

  openAddBudget() {
    this.editingBudget = null;
    this.budgetForm = { month: this.currentMonthStr(), limitAmount: 0 };
    this.showBudgetModal = true;
  }

  openEditBudget(b: BudgetWithUsage) {
    this.editingBudget = b;
    this.budgetForm = { ...b };
    this.showBudgetModal = true;
  }

  closeBudgetModal() {
    this.showBudgetModal = false;
    this.editingBudget = null;
    this.budgetForm = {};
  }

  saveBudget() {
    if (!this.budgetForm.categoryId || !this.budgetForm.limitAmount) return;
    const payload = { ...this.budgetForm, month: this.currentMonthStr() } as Budget;
    if (this.editingBudget?.id) {
      this.budgetService.update(this.editingBudget.id, payload).subscribe(() => {
        this.closeBudgetModal();
        this.loadBudgets();
      });
    } else {
      this.budgetService.create(payload).subscribe(() => {
        this.closeBudgetModal();
        this.loadBudgets();
      });
    }
  }

  confirmDeleteBudget(id: number) { this.deleteBudgetId = id; }
  cancelDeleteBudget() { this.deleteBudgetId = null; }

  deleteBudget() {
    if (!this.deleteBudgetId) return;
    this.budgetService.delete(this.deleteBudgetId).subscribe(() => {
      this.deleteBudgetId = null;
      this.loadBudgets();
    });
  }

  ngOnInit() {
    this.categoryService.getAll().subscribe(cats => this.categories = cats);
    this.applyPreset('month');
    this.loadBudgets();
  }

  ngOnDestroy() {
    this.barChart?.destroy();
    this.pieChart?.destroy();
  }

  // ---- Gestion de la période ----

  get periodLabel(): string {
    switch (this.selectedPreset) {
      case 'month':      return this.capitalize(new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date()));
      case 'last-month': return this.capitalize(new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(this.firstDayOfLastMonth()));
      case '7days':      return '7 derniers jours';
      case 'custom':     return `${this.formatShort(this.periodStart)} – ${this.formatShort(this.periodEnd)}`;
    }
  }

  applyPreset(preset: Preset) {
    this.selectedPreset = preset;
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === 'month') {
      this.periodStart = fmt(new Date(today.getFullYear(), today.getMonth(), 1));
      this.periodEnd   = fmt(today);
    } else if (preset === 'last-month') {
      const first = this.firstDayOfLastMonth();
      const last  = new Date(today.getFullYear(), today.getMonth(), 0);
      this.periodStart = fmt(first);
      this.periodEnd   = fmt(last);
    } else if (preset === '7days') {
      const d7 = new Date(today);
      d7.setDate(d7.getDate() - 6);
      this.periodStart = fmt(d7);
      this.periodEnd   = fmt(today);
    }

    if (preset !== 'custom') {
      this.showPeriodPicker = false;
      this.load();
    }
  }

  applyCustom() {
    if (!this.customStart || !this.customEnd) return;
    this.selectedPreset = 'custom';
    this.periodStart = this.customStart;
    this.periodEnd   = this.customEnd;
    this.showPeriodPicker = false;
    this.load();
  }

  private firstDayOfLastMonth(): Date {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth() - 1, 1);
  }

  private formatShort(iso: string): string {
    if (!iso) return '';
    return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  }

  private capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('.period-picker-wrap')) {
      this.showPeriodPicker = false;
    }
  }

  // ---- Chargement des données ----

  load() {
    this.loading = true;
    this.dashboardService.getDashboard(this.periodStart, this.periodEnd).subscribe({
      next: (data) => {
        this.dashboard = data;
        this.loading = false;
        this.categoryExpenses = this.computeCategoryExpenses(data);
        setTimeout(() => this.renderCharts(), 100);
      },
      error: () => { this.loading = false; }
    });
  }

  renderCharts() {
    if (!this.dashboard) return;
    this.renderBarChart();
    this.renderPieChart();
  }

  get filteredMonthlyData() {
    const all = this.dashboard?.monthlyData || [];
    const start = this.periodStart?.slice(0, 7);
    const end   = this.periodEnd?.slice(0, 7);
    if (!start || !end) return all;
    return all.filter(d => d.month >= start && d.month <= end);
  }

  get chartEvolutionTitle(): string {
    switch (this.selectedPreset) {
      case 'month':      return 'Ce mois';
      case 'last-month': return 'Mois dernier';
      case '7days':      return '7 derniers jours';
      case 'custom':     return `${this.formatShort(this.periodStart)} – ${this.formatShort(this.periodEnd)}`;
    }
  }

  renderBarChart() {
    if (!this.barChartRef) return;

    // Détruire proprement + vider le canvas pour éviter les résidus Chart.js
    if (this.barChart) { this.barChart.destroy(); this.barChart = null; }
    const canvas = this.barChartRef.nativeElement as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

    const data = this.filteredMonthlyData;

    if (!data.length) return; // aucune donnée pour cette période

    const labels = data.map(d => {
      const [y, m] = d.month.split('-');
      return new Date(+y, +m - 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
    });

    this.barChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Revenus',  data: data.map(d => d.income),   backgroundColor: '#10b981', borderRadius: 7, borderSkipped: false, barPercentage: 0.68 },
          { label: 'Dépenses', data: data.map(d => d.expenses), backgroundColor: '#ef4444', borderRadius: 7, borderSkipped: false, barPercentage: 0.68 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 300 },
        plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 7, padding: 20 } } },
        scales: {
          x: { grid: { display: false }, border: { display: false } },
          y: { beginAtZero: true, border: { display: false }, grid: { color: '#edf1f6' }, ticks: { callback: (v) => v + ' €' } }
        }
      }
    });
  }

  renderPieChart() {
    if (!this.pieChartRef) return;
    if (this.pieChart) this.pieChart.destroy();
    const data = this.dashboard!.expensesByCategory;
    const keys = Object.keys(data);
    if (keys.length === 0) return;
    this.pieChart = new Chart(this.pieChartRef.nativeElement, {
      type: 'doughnut',
      data: {
        labels: keys,
        datasets: [{ data: keys.map(k => data[k]), backgroundColor: this.chartColors.slice(0, keys.length), borderWidth: 2, borderColor: '#fff' }]
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '72%', plugins: { legend: { display: false } } }
    });
  }

  formatCurrency(v: number): string {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);
  }

  formatDate(d: string): string {
    return new Date(d).toLocaleDateString('fr-FR');
  }

  get currentMonth(): string {
    return this.periodLabel;
  }

  get positiveSavingsRate(): number {
    return Math.max(0, Math.min(this.dashboard?.savingsRate || 0, 100));
  }

  get expenseRatio(): number {
    if (!this.dashboard?.totalIncome) return 0;
    return Math.max(0, (this.dashboard.totalExpenses / this.dashboard.totalIncome) * 100);
  }

  get savingsMessage(): string {
    if (!this.dashboard || this.dashboard.balance < 0) return 'Vos dépenses dépassent vos revenus. Un ajustement serait utile.';
    if (this.dashboard.savingsRate >= 20) return 'Belle trajectoire : vous dépassez le niveau d\'épargne recommandé.';
    return 'Chaque ajustement compte pour vous rapprocher du cap recommandé.';
  }

  private computeCategoryExpenses(data: Dashboard): { name: string; amount: number; color: string }[] {
    const expenses = data.expensesByCategory || {};
    return Object.entries(expenses)
      .map(([name, amount], index) => ({ name, amount, color: this.chartColors[index % this.chartColors.length] }))
      .sort((a, b) => b.amount - a.amount);
  }

  private get chartColors(): string[] {
    return ['#2563eb', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16'];
  }
}
