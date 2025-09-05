# Money Kaki Analytics API Documentation

## Overview
The Analytics API provides comprehensive financial data visualization and insights for the Money Kaki application. It returns all charts, KPIs, and analytics data in a single unified response for optimal performance and simplicity.

## Base URL
```
/api/analytics
```

## Authentication
All endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Single Unified Endpoint

### Analytics Dashboard
**Endpoint:** `GET /api/analytics/dashboard`

**Description:** Returns all analytics data including charts, KPIs, and insights in a single response.

**Query Parameters:**
- `period` (optional): Time period - `today`, `week`, `month`, `quarter`, `year`, `all`, `custom` (default: `all`)
- `type` (optional): Transaction type - `income`, `expense`, `transfer`, `investment` (default: `expense`)
- `periods` (optional): Comma-separated periods for comparison (default: `current,previous`)
- `startDate` (optional): Start date for custom period (format: `YYYY-MM-DD`) - required when `period=custom`
- `endDate` (optional): End date for custom period (format: `YYYY-MM-DD`) - required when `period=custom`

**Example Requests:**
```
# Default (all transactions)
GET /api/analytics/dashboard

# Specific period
GET /api/analytics/dashboard?period=month&type=expense

# Custom date range
GET /api/analytics/dashboard?period=custom&startDate=2024-01-01&endDate=2024-12-31&type=expense

# Custom date range for specific transaction
GET /api/analytics/dashboard?period=custom&startDate=2024-06-01&endDate=2024-06-30&type=expense
```

**Complete Response Structure:**
```json
{
  "success": true,
  "data": {
    "period": "month",
    "dateRange": { "start": "2024-01-01", "end": "2024-01-31" },
    "charts": {
      "categorySpending": {
        "chartType": "bar",
        "title": "Expense by Category",
        "data": [
          {
            "name": "Food & Drinks",
            "value": 450.50,
            "count": 12,
            "transactions": [...]
          }
        ],
        "total": 1250.75,
        "transactionCount": 25
      },
      "monthlyTrend": {
        "chartType": "line",
        "title": "Monthly Expense Trend",
        "data": [
          { "month": "2024-01", "amount": 1250.75, "count": 25 }
        ],
        "total": 15000.00,
        "average": 1250.00
      },
      "incomeExpenseRatio": {
        "chartType": "pie",
        "title": "Income vs Expense",
        "data": [
          { "name": "Income", "value": 3000, "color": "#10B981" },
          { "name": "Expense", "value": 2500, "color": "#EF4444" }
        ],
        "summary": {
          "totalIncome": 3000,
          "totalExpense": 2500,
          "netIncome": 500,
          "savingsRate": 16.67
        }
      },
      "topSpendingCategories": {
        "chartType": "donut",
        "title": "All Spending Categories",
        "data": [
          {
            "name": "Food & Drinks",
            "value": 450.50,
            "count": 12,
            "color": "hsl(0, 70%, 50%)"
          }
        ],
        "total": 1250.75,
        "otherCategories": 13
      },
      "dailySpendingHeatmap": {
        "chartType": "heatmap",
        "title": "Daily Spending Pattern",
        "data": [
          { "date": "2024-01-15", "amount": 45.50, "count": 2 }
        ],
        "maxAmount": 150.00,
        "totalDays": 20,
        "averageDaily": 62.50
      },
      "spendingByType": {
        "chartType": "bar",
        "title": "Spending by Transaction Type",
        "data": [
          { "name": "expense", "value": 2500, "count": 30 }
        ],
        "total": 3000
      },
      "categoryComparison": {
        "chartType": "comparison",
        "title": "Category Expense Comparison",
        "periods": ["current", "previous"],
        "data": {
          "current": {
            "dateRange": { "start": "2024-01-01", "end": "2024-01-31" },
            "data": [...]
          },
          "previous": {
            "dateRange": { "start": "2023-12-01", "end": "2023-12-31" },
            "data": [...]
          }
        }
      }
    },
    "kpis": {
      "totalIncome": 3000,
      "totalExpense": 2500,
      "netIncome": 500,
      "savingsRate": 16.67,
      "transactionCount": 45,
      "avgTransactionAmount": 55.56,
      "topSpendingCategory": {
        "category": "Food & Drinks",
        "amount": 450.50
      },
      "budgetUtilization": 83.33,
      "monthlyBudget": 3000
    },
    "insights": {
      "isOverspending": false,
      "isSaving": true,
      "spendingTrend": "stable",
      "topCategoryPercentage": 18.02,
      "periodSummary": {
        "totalTransactions": 45,
        "averageDailySpending": 80.65,
        "mostActiveDay": {
          "date": "2024-01-15",
          "amount": 150.00,
          "count": 3
        }
      }
    }
  }
}

## Time Periods
- `today`: Current day
- `week`: Last 7 days
- `month`: Last 30 days
- `quarter`: Last 3 months
- `year`: Last 12 months
- `all`: All available data
- `custom`: Custom date range (requires `startDate` and `endDate` parameters)

## Custom Date Ranges
When using `period=custom`, you must provide both `startDate` and `endDate` parameters:

**Format:** `YYYY-MM-DD` (ISO 8601 date format)

**Examples:**
- `startDate=2024-01-01&endDate=2024-12-31` - Full year 2024
- `startDate=2024-06-01&endDate=2024-06-30` - June 2024 only
- `startDate=2024-06-02&endDate=2024-06-02` - Single day (June 2, 2024)

**Usage:**
```
GET /api/analytics/dashboard?period=custom&startDate=2024-06-01&endDate=2024-06-30&type=expense
```

## Transaction Types
- `income`: Money received
- `expense`: Money spent
- `transfer`: Money moved between accounts
- `investment`: Investment transactions

## Available Categories
- Special Promos
- Food & Drinks
- Car
- Shopping
- Transport
- Travel
- Entertainment
- Health
- Grocery
- Pet
- Education
- Electronics
- Beauty
- Sports

## Chart Types Supported
- **Bar Chart**: Category spending, spending by type
- **Line Chart**: Monthly trends
- **Pie Chart**: Income vs expense ratio
- **Donut Chart**: Top spending categories
- **Heatmap**: Daily spending patterns
- **Comparison**: Multi-period comparisons
- **KPI Cards**: Financial metrics and insights

## Error Handling
All endpoints return consistent error responses:

```json
{
  "error": "Error message description"
}
```

Common HTTP status codes:
- `200`: Success
- `400`: Bad Request (invalid parameters)
- `401`: Unauthorized (invalid/missing token)
- `500`: Internal Server Error

## Usage Examples

### Frontend Integration Example (React)
```javascript
// Fetch category spending data
const fetchCategorySpending = async (period = 'month') => {
  try {
    const response = await fetch(`/api/analytics/category-spending?period=${period}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching category spending:', error);
  }
};

// Fetch financial KPIs
const fetchKPIs = async (period = 'month') => {
  try {
    const response = await fetch(`/api/analytics/financial-kpis?period=${period}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching KPIs:', error);
  }
};
```

### Chart.js Integration Example
```javascript
// Category spending bar chart
const categoryData = await fetchCategorySpending('month');
const chartConfig = {
  type: 'bar',
  data: {
    labels: categoryData.categories.map(cat => cat.name),
    datasets: [{
      label: 'Amount Spent',
      data: categoryData.categories.map(cat => cat.value),
      backgroundColor: 'rgba(54, 162, 235, 0.2)',
      borderColor: 'rgba(54, 162, 235, 1)',
      borderWidth: 1
    }]
  },
  options: {
    responsive: true,
    scales: {
      y: {
        beginAtZero: true
      }
    }
  }
};
```

## Performance Considerations
- All queries are optimized with proper indexing on user_id, date, and type fields
- Data is aggregated at the database level for better performance
- Large date ranges may take longer to process
- Consider implementing caching for frequently accessed data

## Future Enhancements
- Real-time analytics with WebSocket support
- Advanced filtering options (amount ranges, specific categories)
- Export functionality (PDF, CSV)
- Custom date range selection
- Comparative analytics with previous periods
- Budget vs actual spending analysis
- Spending predictions based on trends
