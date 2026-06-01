import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GoalService } from '../../services/goal.service';
import { SavingsGoal } from '../../models/goal.model';

@Component({
  selector: 'app-goals',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
  contributeAmount = 0;
  deleteConfirmId: number | null = null;

  icons = ['🏠', '🚗', '✈️', '📱', '💻', '🎓', '💍', '🏖️', '🎯', '💰', '🏦', '🛒'];

  form: SavingsGoal = this.emptyForm();

  constructor(private goalService: GoalService) {}

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

  openContribute(id: number) {
    this.contributeGoalId = id;
    this.contributeAmount = 0;
    this.showContributeModal = true;
  }

  closeContributeModal() { this.showContributeModal = false; this.contributeGoalId = null; }

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
