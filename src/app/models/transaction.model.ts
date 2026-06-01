export interface Transaction {
  id?: number;
  description: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  date: string;
  categoryId?: number;
  categoryName?: string;
  categoryColor?: string;
  categoryIcon?: string;
  notes?: string;
}

export interface TransactionFilter {
  type?: string;
  categoryId?: number;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
}
