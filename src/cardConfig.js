// src/cardConfig.js

export const CARD_CONFIG = {
  'cardA': {
    name: 'Axis AIRTEL cc',
    categories: [
      { name: 'Airtel 25%', limit: 250, percentage: 25, keywords: ['airtel broadband', 'airtel'] },
      { name: 'Utility 10%', limit: 250, percentage: 10, keywords: ['electricity', 'gas', 'jio', 'vi'] },
      { name: 'Preferred merchant 10%', percentage: 10, limit: 500, keywords: ['big basket', 'zomato', 'swiggy'] },
    ],
    columnMapping: {
      date: 'Date',
      account: 'Account',
      category: 'Category', // Excel's category column
      subcategory: 'Subcategory', // Excel's subcategory column
      description: 'Note', // Used for keyword matching
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
      date: 'Date',
      account: 'Account',
      category: 'Category',
      subcategory: 'Subcategory',
      description: 'Note',
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
    spent: 0, // This will store the cashback earned
    contributingTransactions: [], // Initialize array to hold transaction details
  }));
};