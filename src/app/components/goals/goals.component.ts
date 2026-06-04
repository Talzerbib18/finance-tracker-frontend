import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GoalService } from '../../services/goal.service';
import { TransactionService } from '../../services/transaction.service';
import { SelectOnFocusDirective } from '../../directives/select-on-focus.directive';
import { SavingsGoal } from '../../models/goal.model';
import { Transaction } from '../../models/transaction.model';

@Component({
  selector: 'app-goals',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectOnFocusDirective],
  templateUrl: './goals.component.html',
  styleUrl: './goals.component.scss'
})
export class GoalsComponent implements OnInit {
  goals: SavingsGoal[] = [];
  loading = true;
  showModal = false;
  showContributeModal = false;
  editingGoal: SavingsGoal | null = null;
  contributeGoalId: number | null = null;
  contributeGoalName = '';
  contributeAmount = 0;
  contributeMax = 0;
  deleteConfirmId: number | null = null;

  showLinkedModal = false;
  linkedTransactions: Transaction[] = [];
  linkedGoal: SavingsGoal | null = null;
  loadingLinked = false;

  editingLinked: Transaction | null = null;
  linkedEditForm: Partial<Transaction> = {};
  deleteLinkedId: number | null = null;

  filterStatus: 'all' | 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED' = 'all';
  sortBy: 'name' | 'progress' | 'amount' | 'date' = 'name';

  icons = ['🏠', '🚗', '✈️', '📱', '💻', '🎓', '💍', '🏖️', '🎯', '💰', '🏦', '🛒'];
  form: SavingsGoal = this.emptyForm();

  constructor(
    private goalService: GoalService,
    private transactionService: TransactionService
  ) {}

  openLinkedTransactions(g: SavingsGoal) {
    this.linkedGoal = g;
    this.showLinkedModal = true;
    this.loadingLinked = true;
    this.transactionService.getAll({ goalId: g.id }).subscribe({
      next: (data) => { this.linkedTransactions = data; this.loadingLinked = false; },
      error: () => { this.loadingLinked = false; }
    });
  }

  closeLinkedModal() {
    this.showLinkedModal = false;
    this.linkedTransactions = [];
    this.linkedGoal = null;
    this.editingLinked = null;
    this.deleteLinkedId = null;
  }

  private refreshLinked() {
    if (!this.linkedGoal?.id) return;
    this.loadingLinked = true;
    this.transactionService.getAll({ goalId: this.linkedGoal.id }).subscribe({
      next: (data) => { this.linkedTransactions = data; this.loadingLinked = false; },
      error: () => { this.loadingLinked = false; }
    });
  }

  // ---- Edit linked transaction ----
  openEditLinked(t: Transaction) {
    this.editingLinked = t;
    this.linkedEditForm = { ...t };
  }

  closeEditLinked() {
    this.editingLinked = null;
    this.linkedEditForm = {};
  }

  saveEditLinked() {
    if (!this.editingLinked?.id) return;
    this.transactionService.update(this.editingLinked.id, this.linkedEditForm as Transaction).subscribe(() => {
      this.closeEditLinked();
      this.refreshLinked();
      this.load(); // recharge les objectifs pour refléter le nouveau montant
    });
  }

  // ---- Delete linked transaction ----
  confirmDeleteLinked(id: number) { this.deleteLinkedId = id; }
  cancelDeleteLinked() { this.deleteLinkedId = null; }

  deleteLinkedTransaction() {
    if (!this.deleteLinkedId) return;
    this.transactionService.delete(this.deleteLinkedId).subscribe(() => {
      this.deleteLinkedId = null;
      this.refreshLinked();
      this.load(); // recharge les objectifs pour mettre à jour currentAmount + barre de progression
    });
  }

  get linkedTotal(): number {
    return this.linkedTransactions.reduce((s, t) => s + t.amount, 0);
  }

  ngOnInit() { this.load(); }

  emptyForm(): SavingsGoal {
    return { name: '', targetAmount: 0, currentAmount: 0, icon: '🎯' };
  }

  load() {
    this.loading = true;
    this.goalService.getAll().subscribe({
      next: (data) => { this.goals = data; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  get filteredGoals(): SavingsGoal[] {
    let list = this.filterStatus === 'all'
      ? [...this.goals]
      : this.goals.filter(g => g.status === this.filterStatus);

    return list.sort((a, b) => {
      switch (this.sortBy) {
        case 'progress': return (b.progressPercentage || 0) - (a.progressPercentage || 0);
        case 'amount':   return b.targetAmount - a.targetAmount;
        case 'date':     return (a.targetDate || '').localeCompare(b.targetDate || '');
        default:         return a.name.localeCompare(b.name);
      }
    });
  }

  get statusCounts() {
    return {
      all:        this.goals.length,
      inProgress: this.goals.filter(g => g.status === 'IN_PROGRESS').length,
      completed:  this.goals.filter(g => g.status === 'COMPLETED').length,
      abandoned:  this.goals.filter(g => g.status === 'ABANDONED').length,
    };
  }

  openCreate() {
    this.editingGoal = null;
    this.form = this.emptyForm();
    this.showModal = true;
  }

  openEdit(g: SavingsGoal) {
    this.editingGoal = g;
    this.form = { ...g };
    this.showModal = true;
  }

  closeModal() { this.showModal = false; }

  save() {
    if (this.editingGoal?.id) {
      this.goalService.update(this.editingGoal.id, this.form).subscribe(() => {
        this.closeModal();
        this.load();
      });
    } else {
      this.goalService.create(this.form).subscribe(() => {
        this.closeModal();
        this.load();
      });
    }
  }

  abandonGoal(g: SavingsGoal) {
    if (!g.id) return;
    this.goalService.abandon(g.id).subscribe(() => this.load());
  }

  reactivateGoal(g: SavingsGoal) {
    if (!g.id) return;
    this.goalService.reactivate(g.id).subscribe(() => this.load());
  }

  openContribute(id: number) {
    const goal = this.goals.find(g => g.id === id);
    this.contributeGoalId = id;
    this.contributeGoalName = goal?.name || '';
    this.contributeMax = goal ? +(goal.targetAmount - goal.currentAmount).toFixed(2) : 0;
    this.contributeAmount = 0;
    this.showContributeModal = true;
  }

  closeContributeModal() {
    this.showContributeModal = false;
    this.contributeGoalId = null;
    this.contributeGoalName = '';
    this.contributeMax = 0;
  }

  saveContribution() {
    if (!this.contributeGoalId || this.contributeAmount <= 0) return;
    this.goalService.contribute(this.contributeGoalId, this.contributeAmount).subscribe(() => {
      this.closeContributeModal();
      this.load();
    });
  }

  confirmDelete(id: number) { this.deleteConfirmId = id; }
  cancelDelete() { this.deleteConfirmId = null; }

  deleteGoal() {
    if (this.deleteConfirmId === null) return;
    this.goalService.delete(this.deleteConfirmId).subscribe(() => {
      this.deleteConfirmId = null;
      this.load();
    });
  }

  formatCurrency(v: number): string {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);
  }

  statusLabel(s?: string): string {
    return s === 'COMPLETED' ? 'Atteint' : s === 'ABANDONED' ? 'Abandonné' : 'En cours';
  }

  statusClass(s?: string): string {
    return s === 'COMPLETED' ? 'badge-completed' : s === 'ABANDONED' ? 'badge-abandoned' : 'badge-in-progress';
  }

  get completedCount(): number { return this.goals.filter(g => g.status === 'COMPLETED').length; }
  get totalTarget(): number { return this.goals.reduce((s, g) => s + g.targetAmount, 0); }
  get totalSaved(): number { return this.goals.reduce((s, g) => s + g.currentAmount, 0); }
}
