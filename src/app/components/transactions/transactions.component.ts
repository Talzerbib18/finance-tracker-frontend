import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TransactionService } from '../../services/transaction.service';
import { CategoryService } from '../../services/category.service';
import { Transaction, TransactionFilter } from '../../models/transaction.model';
import { Category } from '../../models/category.model';

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './transactions.component.html',
  styleUrl: './transactions.component.scss'
})
export class TransactionsComponent implements OnInit {
  transactions: Transaction[] = [];
  categories: Category[] = [];
  loading = true;
  showModal = false;
  deleteConfirmId: number | null = null;
  editingTransaction: Transaction | null = null;

  filter: TransactionFilter = {};
  filterType = '';
  filterCategory = '';
  filterStartDate = '';
  filterEndDate = '';
  filterSearch = '';

  form: Transaction = this.emptyForm();

  constructor(
    private transactionService: TransactionService,
    private categoryService: CategoryService
  ) {}

  ngOnInit() {
    this.loadCategories();
    this.load();
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
    this.transactionService.getAll(f).subscribe({
      next: (data) => { this.transactions = data; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  applyFilter() { this.load(); }

  resetFilter() {
    this.filterType = '';
    this.filterCategory = '';
    this.filterStartDate = '';
    this.filterEndDate = '';
    this.filterSearch = '';
    this.load();
  }

  openCreate() {
    this.editingTransaction = null;
    this.form = this.emptyForm();
    this.showModal = true;
  }

  openEdit(t: Transaction) {
    this.editingTransaction = t;
    this.form = { ...t };
    this.showModal = true;
  }

  closeModal() { this.showModal = false; }

  save() {
    if (this.editingTransaction?.id) {
      this.transactionService.update(this.editingTransaction.id, this.form).subscribe(() => {
        this.closeModal();
        this.load();
      });
    } else {
      this.transactionService.create(this.form).subscribe(() => {
        this.closeModal();
        this.load();
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

  getCategoriesForType(): Category[] {
    return this.categories.filter(c =>
      c.type === this.form.type || c.type === 'BOTH'
    );
  }

  formatCurrency(v: number): string {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);
  }

  formatDate(d: string): string {
    return new Date(d).toLocaleDateString('fr-FR');
  }

  get totalIncome(): number {
    return this.transactions.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
  }

  get totalExpenses(): number {
    return this.transactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
  }
}
