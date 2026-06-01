import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CategoryService } from '../../services/category.service';
import { Category } from '../../models/category.model';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './categories.component.html',
  styleUrl: './categories.component.scss'
})
export class CategoriesComponent implements OnInit {
  categories: Category[] = [];
  loading = true;
  showModal = false;
  editingCategory: Category | null = null;
  deleteConfirmId: number | null = null;

  colors = ['#6366f1','#ef4444','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16','#795548','#607D8B'];
  icons = ['🍔','🏠','🚗','🎮','💊','📚','👗','📱','🍽️','✈️','💼','💻','📈','💰','🏦','🛒','⚡','🎵','🐾','🎨'];

  form: Category = this.emptyForm();

  constructor(private categoryService: CategoryService) {}

  ngOnInit() { this.load(); }

  emptyForm(): Category {
    return { name: '', icon: '🏷️', color: '#6366f1', type: 'EXPENSE' };
  }

  load() {
    this.loading = true;
    this.categoryService.getAll().subscribe({
      next: (data) => { this.categories = data; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  openCreate() {
    this.editingCategory = null;
    this.form = this.emptyForm();
    this.showModal = true;
  }

  openEdit(c: Category) {
    this.editingCategory = c;
    this.form = { ...c };
    this.showModal = true;
  }

  closeModal() { this.showModal = false; }

  save() {
    if (this.editingCategory?.id) {
      this.categoryService.update(this.editingCategory.id, this.form).subscribe(() => {
        this.closeModal();
        this.load();
      });
    } else {
      this.categoryService.create(this.form).subscribe(() => {
        this.closeModal();
        this.load();
      });
    }
  }

  confirmDelete(id: number) { this.deleteConfirmId = id; }
  cancelDelete() { this.deleteConfirmId = null; }

  deleteCategory() {
    if (this.deleteConfirmId === null) return;
    this.categoryService.delete(this.deleteConfirmId).subscribe(() => {
      this.deleteConfirmId = null;
      this.load();
    });
  }

  typeLabel(t: string): string {
    return t === 'INCOME' ? 'Revenu' : t === 'EXPENSE' ? 'Dépense' : 'Les deux';
  }

  get incomeCategories(): Category[] { return this.categories.filter(c => c.type === 'INCOME'); }
  get expenseCategories(): Category[] { return this.categories.filter(c => c.type === 'EXPENSE'); }
  get bothCategories(): Category[] { return this.categories.filter(c => c.type === 'BOTH'); }
}
