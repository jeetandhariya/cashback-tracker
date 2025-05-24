// src/cardConfig.js

export const CARD_CONFIG = {
  'cardA': {
    name: 'Axis AIRTEL cc',
    categories: [
      { name: 'Airtel 25%', limit: 250, percentage: 25, keywords: ['airtel broadband', 'airtel'] },
      { name: 'Utility 10%', limit: 250, percentage: 10, keywords: ['electricity', 'gas', 'jio', 'vi'] },
      { name: 'Preferred merchant 10%', percentage: 10, limit: 500, keywords: ['big basket', 'zomato', 'swiggy'] },
    ],
    // IMPORTANT: Define what your Excel columns are named
    // These MUST match the headers in your Excel file
    columnMapping: {
      date: 'Date', // or 'Transaction Date'
      account: 'Account', // or 'Account name'
      category: 'Category', // or 'Transaction Category'
      subcategory: 'Subcategory', // or 'Transaction Subcategory'
      description: 'Note', // or 'Transaction Description', 'Details'
      amount: 'Amount',
      transactionType: 'Income/Expense'
    }
  },
  'cardB': {
    name: 'SBI Cashback cc',
    categories: [
      { name: 'Online', limit: 5000, percentage: 5, keywords: ['papa', 'grocery'] },
    ],
    columnMapping: {
      date: 'Date', // or 'Transaction Date'
      account: 'Account', // or 'Account name'
      category: 'Category', // or 'Transaction Category'
      subcategory: 'Subcategory', // or 'Transaction Subcategory'
      description: 'Note', // or 'Transaction Description', 'Details'
      amount: 'Amount',
      transactionType: 'Income/Expense'
    }
  },
  // Add more cards here
};

// Helper function to initialize spending for categories
export const getInitialCategorySpending = (cardId) => {
  if (!CARD_CONFIG[cardId]) return [];
  return CARD_CONFIG[cardId].categories.map(cat => ({
    ...cat,
    spent: 0,
  }));
};