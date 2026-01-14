/**
 * Analytics utility functions for calculating metrics and trends
 */

export interface TrendData {
  value: number;
  percentageChange: number;
  isPositive: boolean;
}

/**
 * Calculate engagement rate based on views, likes, comments, and shares
 */
export function calculateEngagementRate(
  views: number,
  likes: number,
  comments: number,
  shares: number
): number {
  if (views === 0) return 0;
  const totalEngagement = likes + comments + shares;
  return (totalEngagement / views) * 100;
}

/**
 * Calculate trend between previous and current values
 * Returns percentage change and whether it's positive
 */
export function formatTrend(previous: number, current: number): TrendData {
  if (previous === 0) {
    return {
      value: current,
      percentageChange: current > 0 ? 100 : 0,
      isPositive: current > 0,
    };
  }

  const percentageChange = ((current - previous) / previous) * 100;
  return {
    value: current,
    percentageChange: Math.abs(percentageChange),
    isPositive: percentageChange >= 0,
  };
}

/**
 * Group data by date for time-series charts
 */
export function groupByDate<T extends Record<string, any>>(
  data: T[],
  dateField: keyof T,
  valueField: keyof T
): Array<{ date: string; value: number }> {
  const grouped = new Map<string, number>();

  data.forEach((item) => {
    const date = new Date(item[dateField] as string | Date);
    const dateKey = date.toISOString().split("T")[0]; // YYYY-MM-DD

    const currentValue = Number(item[valueField] || 0);
    grouped.set(dateKey, (grouped.get(dateKey) || 0) + currentValue);
  });

  return Array.from(grouped.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Calculate cumulative values for growth charts
 */
export function calculateCumulative(
  data: Array<{ date: string; value: number }>
): Array<{ date: string; value: number; cumulative: number }> {
  let cumulative = 0;
  return data.map((item) => {
    cumulative += item.value;
    return {
      ...item,
      cumulative,
    };
  });
}

/**
 * Calculate ROI (Return on Investment) based on spending and views
 * Returns views per currency unit spent
 */
export function calculateROI(spent: number, views: number): number {
  if (spent === 0) return 0;
  return views / spent;
}

/**
 * Filter data by date range
 */
export function filterByDateRange<T extends Record<string, any>>(
  data: T[],
  dateField: keyof T,
  days: number
): T[] {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  return data.filter((item) => {
    const itemDate = new Date(item[dateField] as string | Date);
    return itemDate >= cutoffDate;
  });
}

/**
 * Format percentage with sign
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Calculate average from array of numbers
 */
export function calculateAverage(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
}

/**
 * Group transactions by date and type
 * Returns array with date and revenue (amount) for the specified transaction type
 */
export function groupTransactionsByDate(
  transactions: Array<{ createdAt: Date; type: string; amount: number | string }>,
  type: string
): Array<{ date: string; revenue: number }> {
  const grouped = new Map<string, number>();

  transactions
    .filter((t) => t.type === type)
    .forEach((transaction) => {
      const date = new Date(transaction.createdAt);
      // Validate date
      if (isNaN(date.getTime())) {
        console.warn("Invalid date in transaction:", transaction);
        return;
      }
      const dateKey = date.toISOString().split("T")[0]; // YYYY-MM-DD format
      
      // Safely convert amount to number
      let currentValue = 0;
      if (typeof transaction.amount === "number") {
        currentValue = transaction.amount;
      } else if (typeof transaction.amount === "string") {
        currentValue = parseFloat(transaction.amount) || 0;
      }
      
      // Ensure non-negative values (amounts should be positive)
      if (currentValue < 0) {
        console.warn("Negative amount found in transaction:", transaction);
        currentValue = Math.abs(currentValue);
      }
      
      grouped.set(dateKey, (grouped.get(dateKey) || 0) + currentValue);
    });

  return Array.from(grouped.entries())
    .map(([date, value]) => ({ 
      date, 
      revenue: Number(value.toFixed(2)) // Round to 2 decimal places for currency
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Group users by registration date
 */
export function groupUsersByDate(
  users: Array<{ createdAt: Date }>
): Array<{ date: string; users: number }> {
  const grouped = new Map<string, number>();

  users.forEach((user) => {
    const date = new Date(user.createdAt);
    const dateKey = date.toISOString().split("T")[0];
    grouped.set(dateKey, (grouped.get(dateKey) || 0) + 1);
  });

  return Array.from(grouped.entries())
    .map(([date, value]) => ({ date, users: value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Group submissions by date and status
 */
export function groupSubmissionsByDate(
  submissions: Array<{
    createdAt: Date;
    status: string;
  }>
): Array<{ date: string; total: number; approved?: number; pending?: number; rejected?: number }> {
  const grouped = new Map<
    string,
    { total: number; approved: number; pending: number; rejected: number }
  >();

  submissions.forEach((submission) => {
    const date = new Date(submission.createdAt);
    const dateKey = date.toISOString().split("T")[0];
    const current = grouped.get(dateKey) || {
      total: 0,
      approved: 0,
      pending: 0,
      rejected: 0,
    };

    current.total += 1;
    if (submission.status === "APPROVED") current.approved += 1;
    else if (submission.status === "PENDING") current.pending += 1;
    else if (submission.status === "REJECTED") current.rejected += 1;

    grouped.set(dateKey, current);
  });

  return Array.from(grouped.entries())
    .map(([date, values]) => ({
      date,
      ...values,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Group engagement metrics by date
 */
export function groupEngagementByDate(
  submissions: Array<{
    createdAt: Date;
    lastViewCount: number;
    lastLikeCount: number;
    lastCommentCount: number;
    lastShareCount: number;
  }>
): Array<{ date: string; views: number; likes: number; comments: number; shares: number }> {
  const grouped = new Map<
    string,
    { views: number; likes: number; comments: number; shares: number }
  >();

  submissions.forEach((submission) => {
    const date = new Date(submission.createdAt);
    const dateKey = date.toISOString().split("T")[0];
    const current = grouped.get(dateKey) || {
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
    };

    current.views += submission.lastViewCount || 0;
    current.likes += submission.lastLikeCount || 0;
    current.comments += submission.lastCommentCount || 0;
    current.shares += submission.lastShareCount || 0;

    grouped.set(dateKey, current);
  });

  return Array.from(grouped.entries())
    .map(([date, values]) => ({
      date,
      ...values,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Calculate growth rate between two periods
 */
export function calculateGrowthRate(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Get date range for filtering
 */
export function getDateRange(days: number): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return { start, end };
}

