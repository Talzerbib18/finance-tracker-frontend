export interface SavingsGoal {
  id?: number;
  name: string;
  description?: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string;
  icon?: string;
  status?: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
  progressPercentage?: number;
}
