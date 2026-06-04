export interface Budget {
  id?: number;
  categoryId: number;
  categoryName?: string;
  categoryIcon?: string;
  categoryColor?: string;
  month: string;        // format YYYY-MM
  limitAmount: number;
  spentAmount?: number; // calculé par le backend ou le frontend
}

export interface BudgetWithUsage extends Budget {
  spentAmount: number;
  usagePercent: number;
  remaining: number;
  status: 'safe' | 'warning' | 'exceeded';
}
