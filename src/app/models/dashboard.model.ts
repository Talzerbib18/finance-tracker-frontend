export interface Dashboard {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  savingsRate: number;
  monthlyData: MonthlyData[];
  expensesByCategory: { [key: string]: number };
  recentTransactions: RecentTransaction[];
}

export interface MonthlyData {
  month: string;
  income: number;
  expenses: number;
}

export interface RecentTransaction {
  description: string;
  amount: number;
  type: string;
  date: string;
  category: string;
  categoryColor: string;
}
