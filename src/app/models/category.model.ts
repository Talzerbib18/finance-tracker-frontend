export interface Category {
  id?: number;
  name: string;
  icon?: string;
  color?: string;
  type: 'INCOME' | 'EXPENSE' | 'BOTH';
}
