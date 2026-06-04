import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TransactionService } from '../../services/transaction.service';
import { CategoryService } from '../../services/category.service';
import { GoalService } from '../../services/goal.service';
import { Transaction, TransactionFilter, BudgetWarning } from '../../models/transaction.model';
import { Category } from '../../models/category.model';
import { SavingsGoal } from '../../models/goal.model';
import { BudgetService } from '../../services/budget.service';
import { Budget } from '../../models/budget.model';
import { SelectOnFocusDirective } from '../../directives/select-on-focus.directive';
import { ExcelService, ImportRow } from '../../services/excel.service';

type SortCol = 'date' | 'amount' | 'description';

export interface ActiveFilter {
  key: string;
  label: string;
}


@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectOnFocusDirective],
  templateUrl: './transactions.component.html',
  styleUrl: './transactions.component.scss'
})
export class TransactionsComponent implements OnInit {
  transactions: Transaction[] = [];
  categories: Category[] = [];
  goals: SavingsGoal[] = [];
  loading = true;
  showModal = false;
  deleteConfirmId: number | null = null;
  editingTransaction: Transaction | null = null;

  filterType = '';
  filterCategory = '';
  filterStartDate = '';
  filterEndDate = '';
  filterSearch = '';
  filterMinAmount: number | null = null;
  filterMaxAmount: number | null = null;

  sortBy: SortCol = 'date';
  sortDir: 'asc' | 'desc' = 'desc';

  activeFilters: ActiveFilter[] = [];

  currentPage = 1;
  pageSize = 15;

  formTime = '';
  budgetWarning: BudgetWarning | null = null;
  budgetWarnings: string[] = [];
  formBudgetError: string | null = null;
  budgets: Budget[] = [];

  // ---- Import Excel ----
  showImportModal = false;
  importRows: ImportRow[] = [];
  importLoading = false;
  importDone = false;
  importSuccess = 0;
  importErrors = 0;

  private searchTimer?: ReturnType<typeof setTimeout>;

  form: Transaction = this.emptyForm();

  constructor(
    private transactionService: TransactionService,
    private categoryService: CategoryService,
    private goalService: GoalService,
    private budgetService: BudgetService,
    private excelService: ExcelService
  ) {}

  // ---- Export Excel ----
  exportExcel() {
    this.excelService.exportTransactions(this.transactions);
  }

  downloadTemplate() {
    this.excelService.generateTemplate();
  }

  // ---- Import Excel ----
  openImportModal() {
    this.showImportModal = true;
    this.importRows = [];
    this.importDone = false;
    this.importSuccess = 0;
    this.importErrors = 0;
  }

  closeImportModal() {
    this.showImportModal = false;
    if (this.importDone) this.load();
  }

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    input.value = '';

    try {
      this.importRows = await this.excelService.parseFile(file);
      this.excelService.resolveCategories(this.importRows, this.categories);
    } catch {
      this.importRows = [];
    }
  }

  get importOkCount()    { return this.importRows.filter(r => r.status === 'ok').length; }
  get importErrorCount() { return this.importRows.filter(r => r.status === 'error').length; }

  async confirmImport() {
    const valid = this.importRows.filter(r => r.status === 'ok');
    if (!valid.length) return;

    this.importLoading = true;
    this.importSuccess = 0;
    this.importErrors = 0;

    for (const row of valid) {
      try {
        await this.transactionService.create({
          description: row.description,
          amount:      row.amount,
          type:        row.type,
          date:        row.date,
          categoryId:  (row as any).categoryId,
          notes:       row.notes
        }).toPromise();
        row.status = 'ok';
        this.importSuccess++;
      } catch (err: any) {
        row.status = 'error';
        if (err?.error?.error === 'BudgetExceeded') {
          row.error = `⚠️ Budget "${err.error.categoryName}" dépassé de ${(+err.error.exceededBy).toFixed(2)} €`;
        } else {
          row.error = err?.error?.message || 'Erreur lors de la création';
        }
        this.importErrors++;
      }
    }

    this.importLoading = false;
    this.importDone = true;

    // Remonter les erreurs budget dans le banner principal
    const budgetErrors = this.importRows
      .filter(r => r.status === 'error' && r.error?.includes('Budget'))
      .map(r => r.error!);
    if (budgetErrors.length > 0) {
      this.budgetWarnings = budgetErrors;
    }
  }

  ngOnInit() {
    this.loadCategories();
    this.loadGoals();
    this.loadBudgets();
    this.load();
  }

  loadBudgets() {
    const d = new Date();
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    this.budgetService.getAll(month).subscribe({
      next: (b) => { this.budgets = b; },
      error: () => {}
    });
  }

  checkBudget() {
    this.formBudgetError = null;
    if (this.form.type !== 'EXPENSE' || !this.form.categoryId || !this.form.amount) return;

    const d = new Date();
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const budget = this.budgets.find(b => b.categoryId === this.form.categoryId && b.month === month);
    if (!budget) return;

    const spent = budget.spentAmount ?? 0;
    // Si on modifie une transaction existante, on retire son ancien montant
    const editingAmt = (this.editingTransaction?.categoryId === this.form.categoryId)
      ? (this.editingTransaction?.amount ?? 0) : 0;
    const base = spent - editingAmt;
    const newTotal = base + Number(this.form.amount);

    if (newTotal > budget.limitAmount) {
      const excess    = newTotal - budget.limitAmount;
      const available = Math.max(0, budget.limitAmount - base);
      this.formBudgetError =
        `Vous dépassez le budget "${budget.categoryName}" de ${this.formatCurrency(excess)}. ` +
        `Disponible : ${this.formatCurrency(available)}.`;
    }
  }

  loadGoals() {
    this.goalService.getAll().subscribe(goals => this.goals = goals);
  }

  emptyForm(): Transaction {
    return {
      description: '',
      amount: 0,
      type: 'EXPENSE',
      date: new Date().toISOString().split('T')[0],
      categoryId: undefined,
      notes: ''
    };
  }

  private nowTime(): string {
    return new Date().toTimeString().slice(0, 5);
  }

  loadCategories() {
    this.categoryService.getAll().subscribe(cats => this.categories = cats);
  }

  load() {
    this.loading = true;
    const f: TransactionFilter = {};
    if (this.filterType) f.type = this.filterType;
    if (this.filterCategory) f.categoryId = +this.filterCategory;
    if (this.filterStartDate) f.startDate = this.filterStartDate;
    if (this.filterEndDate) f.endDate = this.filterEndDate;
    if (this.filterSearch) f.search = this.filterSearch;
    if (this.filterMinAmount != null) f.minAmount = this.filterMinAmount;
    if (this.filterMaxAmount != null) f.maxAmount = this.filterMaxAmount;

    this.transactionService.getAll(f).subscribe({
      next: (data) => {
        // Filtre client en complément du backend (sécurité timezone / backend)
        this.transactions = this.clientFilter(data);
        this.applySort();
        this.loading = false;
        this.computeActiveFilters();
      },
      error: () => { this.loading = false; }
    });
  }

  private clientFilter(data: Transaction[]): Transaction[] {
    return data.filter(t => {
      const d = (t.date || '').split('T')[0]; // YYYY-MM-DD
      if (this.filterStartDate && d < this.filterStartDate) return false;
      if (this.filterEndDate && d > this.filterEndDate) return false;
      if (this.filterMinAmount != null && t.amount < this.filterMinAmount) return false;
      if (this.filterMaxAmount != null && t.amount > this.filterMaxAmount) return false;
      if (this.filterType && t.type !== this.filterType) return false;
      if (this.filterSearch) {
        const q = this.filterSearch.toLowerCase();
        if (!t.description.toLowerCase().includes(q) && !(t.notes || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }

  private computeActiveFilters() {
    const f: ActiveFilter[] = [];
    if (this.filterSearch) f.push({ key: 'search', label: `Recherche : "${this.filterSearch}"` });
    if (this.filterType) f.push({ key: 'type', label: `Type : ${this.filterType === 'INCOME' ? 'Revenu' : 'Dépense'}` });
    if (this.filterCategory) {
      const cat = this.categories.find(c => c.id === +this.filterCategory);
      f.push({ key: 'category', label: `Catégorie : ${cat?.name || ''}` });
    }
    if (this.filterStartDate) f.push({ key: 'startDate', label: `Du ${new Date(this.filterStartDate + 'T00:00:00').toLocaleDateString('fr-FR')}` });
    if (this.filterEndDate) f.push({ key: 'endDate', label: `Au ${new Date(this.filterEndDate + 'T00:00:00').toLocaleDateString('fr-FR')}` });
    if (this.filterMinAmount != null) f.push({ key: 'minAmount', label: `Min : ${this.formatCurrency(this.filterMinAmount)}` });
    if (this.filterMaxAmount != null) f.push({ key: 'maxAmount', label: `Max : ${this.formatCurrency(this.filterMaxAmount)}` });
    this.activeFilters = f;
  }

  removeFilter(key: string) {
    switch (key) {
      case 'search':    this.filterSearch = ''; break;
      case 'type':      this.filterType = ''; break;
      case 'category':  this.filterCategory = ''; break;
      case 'startDate': this.filterStartDate = ''; break;
      case 'endDate':   this.filterEndDate = ''; break;
      case 'minAmount': this.filterMinAmount = null; break;
      case 'maxAmount': this.filterMaxAmount = null; break;
    }
    this.load();
  }

  get pagedTransactions(): Transaction[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.transactions.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.ceil(this.transactions.length / this.pageSize);
  }

  get pageNumbers(): number[] {
    const total = this.totalPages;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (this.currentPage <= 4) return [1, 2, 3, 4, 5, -1, total];
    if (this.currentPage >= total - 3) return [1, -1, total - 4, total - 3, total - 2, total - 1, total];
    return [1, -1, this.currentPage - 1, this.currentPage, this.currentPage + 1, -1, total];
  }

  goToPage(p: number) {
    if (p >= 1 && p <= this.totalPages) this.currentPage = p;
  }

  applyFilter() { this.currentPage = 1; this.load(); }

  onSearchInput() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(), 350);
  }

  resetFilter() {
    this.filterType = '';
    this.filterCategory = '';
    this.filterStartDate = '';
    this.filterEndDate = '';
    this.filterSearch = '';
    this.filterMinAmount = null;
    this.filterMaxAmount = null;
    this.currentPage = 1;
    this.load();
  }

  sort(col: SortCol) {
    if (this.sortBy === col) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = col;
      this.sortDir = col === 'date' ? 'desc' : 'asc';
    }
    this.applySort();
  }

  private applySort() {
    this.transactions = [...this.transactions].sort((a, b) => {
      let va: any = a[this.sortBy];
      let vb: any = b[this.sortBy];
      if (this.sortBy === 'date') { va = va || ''; vb = vb || ''; }
      if (this.sortBy === 'amount') { va = +(va ?? 0); vb = +(vb ?? 0); }
      if (va === vb) return 0;
      return this.sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });
  }

  openCreate() {
    this.editingTransaction = null;
    this.form = this.emptyForm();
    this.formTime = this.nowTime();
    this.formBudgetError = null;
    this.showModal = true;
  }

  openEdit(t: Transaction) {
    this.editingTransaction = t;
    this.form = { ...t, date: (t.date || '').split('T')[0] };
    this.formTime = t.date?.includes('T') ? t.date.split('T')[1].slice(0, 5) : '';
    this.formBudgetError = null;
    this.showModal = true;
    setTimeout(() => this.checkBudget(), 0);
  }

  duplicate(t: Transaction) {
    this.editingTransaction = null;
    this.form = {
      description: t.description,
      amount: t.amount,
      type: t.type,
      date: new Date().toISOString().split('T')[0],
      categoryId: t.categoryId,
      notes: t.notes
    };
    this.formTime = this.nowTime();
    this.formBudgetError = null;
    this.showModal = true;
    setTimeout(() => this.checkBudget(), 0);
  }

  closeModal() { this.showModal = false; this.formBudgetError = null; }

  save() {
    if (this.formBudgetError) return; // bloqué par dépassement budget

    const payload: Transaction = {
      ...this.form,
      date: this.formTime ? `${this.form.date}T${this.formTime}` : this.form.date
    };
    const onError = (err: any) => {
      if (err.status === 400 && err.error?.error === 'BudgetExceeded') {
        this.formBudgetError =
          `Budget "${err.error.categoryName}" dépassé de ${this.formatCurrency(err.error.exceededBy)}. ` +
          `Dépensé : ${this.formatCurrency(err.error.spentAmount)} / ${this.formatCurrency(err.error.limitAmount)}.`;
      } else {
        this.formBudgetError = err.error?.message || 'Une erreur est survenue.';
      }
    };

    if (this.editingTransaction?.id) {
      this.transactionService.update(this.editingTransaction.id, payload).subscribe({
        next: () => { this.closeModal(); this.load(); },
        error: onError
      });
    } else {
      this.transactionService.create(payload).subscribe({
        next: () => { this.closeModal(); this.load(); },
        error: onError
      });
    }
  }

  confirmDelete(id: number) { this.deleteConfirmId = id; }
  cancelDelete() { this.deleteConfirmId = null; }

  deleteTransaction() {
    if (this.deleteConfirmId === null) return;
    this.transactionService.delete(this.deleteConfirmId).subscribe(() => {
      this.deleteConfirmId = null;
      this.load();
    });
  }

  exportCsv() {
    const headers = ['Date', 'Description', 'Type', 'Catégorie', 'Montant (€)', 'Notes'];
    const rows = this.transactions.map(t => [
      t.date,
      t.description,
      t.type === 'INCOME' ? 'Revenu' : 'Dépense',
      t.categoryName || '',
      t.amount.toString().replace('.', ','),
      t.notes || ''
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  getCategoriesForType(): Category[] {
    return this.categories.filter(c => c.type === this.form.type || c.type === 'BOTH');
  }

  formatCurrency(v: number): string {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);
  }

  formatDate(d: string): string {
    if (!d) return '';
    const hasTime = d.includes('T') && d.split('T')[1] > '00:00';
    const date = new Date(d.includes('T') ? d : d + 'T00:00:00');
    const datePart = date.toLocaleDateString('fr-FR');
    if (hasTime) {
      const timePart = d.split('T')[1].slice(0, 5);
      return `${datePart} · ${timePart}`;
    }
    return datePart;
  }

  minVal(a: number, b: number): number { return Math.min(a, b); }

  get totalIncome(): number {
    return this.transactions.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
  }

  get totalExpenses(): number {
    return this.transactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
  }
}
