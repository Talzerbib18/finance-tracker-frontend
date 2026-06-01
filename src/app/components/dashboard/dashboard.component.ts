import { Component, OnInit, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DashboardService } from '../../services/dashboard.service';
import { Dashboard } from '../../models/dashboard.model';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit, AfterViewInit {
  @ViewChild('barChart') barChartRef!: ElementRef;
  @ViewChild('pieChart') pieChartRef!: ElementRef;

  dashboard: Dashboard | null = null;
  loading = true;
  barChart: Chart | null = null;
  pieChart: Chart | null = null;

  constructor(private dashboardService: DashboardService) {}

  ngOnInit() {
    this.load();
  }

  ngAfterViewInit() {}

  load() {
    this.loading = true;
    this.dashboardService.getDashboard().subscribe({
      next: (data) => {
        this.dashboard = data;
        this.loading = false;
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

  renderBarChart() {
    if (!this.barChartRef) return;
    if (this.barChart) this.barChart.destroy();
    const data = this.dashboard!.monthlyData;
    const labels = data.map(d => {
      const [y, m] = d.month.split('-');
      return new Date(+y, +m - 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
    });
    this.barChart = new Chart(this.barChartRef.nativeElement, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Revenus',
            data: data.map(d => d.income),
            backgroundColor: '#10b981',
            borderRadius: 6,
          },
          {
            label: 'Dépenses',
            data: data.map(d => d.expenses),
            backgroundColor: '#ef4444',
            borderRadius: 6,
          }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: (v) => v + ' €' }
          }
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
    const colors = ['#6366f1','#ef4444','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16'];
    this.pieChart = new Chart(this.pieChartRef.nativeElement, {
      type: 'doughnut',
      data: {
        labels: keys,
        datasets: [{
          data: keys.map(k => data[k]),
          backgroundColor: colors.slice(0, keys.length),
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }

  formatCurrency(v: number): string {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);
  }

  formatDate(d: string): string {
    return new Date(d).toLocaleDateString('fr-FR');
  }
}
