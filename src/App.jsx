// src/App.js
import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { CARD_CONFIG, getInitialCategorySpending } from './cardConfig'; // Assuming cardConfig.js is in the same directory
import './App.css';

function App() {
  const [selectedCardId, setSelectedCardId] = useState('');
  const [file, setFile] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [categorySpend, setCategorySpend] = useState([]); // Stores { name, limit, percentage, keywords, spent }
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [processedTxCount, setProcessedTxCount] = useState(0);
  const [relevantTxCount, setRelevantTxCount] = useState(0);


  useEffect(() => {
    if (selectedCardId) {
      setCategorySpend(getInitialCategorySpending(selectedCardId));
      setTransactions([]);
      setProcessedTxCount(0);
      setRelevantTxCount(0);
      setFile(null);
      if (document.getElementById('file-upload')) {
        document.getElementById('file-upload').value = null;
      }
    } else {
      setCategorySpend([]);
    }
    setError('');
  }, [selectedCardId]);

  const handleCardChange = (event) => {
    setSelectedCardId(event.target.value);
  };

  const handleFileChange = (event) => {
    const uploadedFile = event.target.files[0];
    if (uploadedFile && (uploadedFile.name.endsWith('.xlsx') || uploadedFile.name.endsWith('.xls'))) {
      setFile(uploadedFile);
      setError('');
    } else {
      setFile(null);
      event.target.value = null;
      setError('Please upload a valid .xls or .xlsx file.');
    }
  };

  const processFile = () => {
    if (!file || !selectedCardId) {
      setError('Please select a card and upload a file first.');
      return;
    }
    setIsLoading(true);
    setError('');
    setProcessedTxCount(0);
    setRelevantTxCount(0);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        setProcessedTxCount(jsonData.length);

        const cardConfig = CARD_CONFIG[selectedCardId];
        const {
          account: accountCol,
          description: descCol,
          amount: amountCol,
          transactionType: transTypeCol
        } = cardConfig.columnMapping;

        if (jsonData.length > 0) {
          const firstRow = jsonData[0];
          const missingColumns = [];
          if (!(accountCol in firstRow)) missingColumns.push(accountCol);
          if (!(descCol in firstRow)) missingColumns.push(descCol);
          if (!(amountCol in firstRow)) missingColumns.push(amountCol);
          if (!(transTypeCol in firstRow)) missingColumns.push(transTypeCol);

          if (missingColumns.length > 0) {
            setError(`Excel columns missing or misnamed. Expected: '${missingColumns.join("', '")}'. Check cardConfig.js and your Excel file headers.`);
            setTransactions([]);
            setIsLoading(false);
            return;
          }
        }

        setTransactions(jsonData); // Store all transactions for potential display/debug
        calculateSpending(jsonData, selectedCardId);
      } catch (err) {
        console.error("Error processing file:", err);
        setError('Error processing Excel file. Ensure it is not corrupted and columns are correctly mapped.');
        setTransactions([]);
      } finally {
        setIsLoading(false);
      }
    };
    reader.onerror = (err) => {
      console.error("FileReader error:", err);
      setError('Error reading file.');
      setIsLoading(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const calculateSpending = (allTransactions, cardId) => {
    const cardConfigData = CARD_CONFIG[cardId];
    if (!cardConfigData) return;

    const newCategorySpend = getInitialCategorySpending(cardId); // Reset spend for categories
    const {
      account: accountCol,
      description: descCol,
      amount: amountCol,
      transactionType: transTypeCol
    } = cardConfigData.columnMapping;

    let currentRelevantTxCount = 0;

    allTransactions.forEach(row => {
      const transactionAccount = String(row[accountCol] || '').trim().toLowerCase();
      const cardAccountName = String(cardConfigData.name || '').trim().toLowerCase();
      const transactionType = String(row[transTypeCol] || '').trim().toLowerCase();

      // 1. Filter by Account Name
      if (transactionAccount !== cardAccountName) {
        return; // Skip if account doesn't match selected card's expected account name
      }

      // 2. Filter by Transaction Type (must be 'Expense')
      if (transactionType !== 'expense') {
        return; // Skip if not an expense
      }

      // If we reach here, the transaction is relevant for the selected card and is an expense
      currentRelevantTxCount++;

      const description = String(row[descCol] || '').toLowerCase();
      const transactionAmount = parseFloat(String(row[amountCol]).replace(/[^0-9.-]+/g, ""));

      if (isNaN(transactionAmount) || transactionAmount <= 0) {
        return; // Ignore non-numeric or non-positive amounts
      }

      for (const category of newCategorySpend) {
        for (const keyword of category.keywords) {
          if (description.includes(keyword.toLowerCase())) {
            // 3. Calculate cashback amount for this transaction based on category percentage
            const cashbackForThisTx = transactionAmount * (category.percentage / 100);
            category.spent += cashbackForThisTx;
            // Note: category.limit is the limit for cashback earned.
            // category.spent now accumulates cashback earned.
            return; // Assign to first matching category and move to next transaction
          }
        }
      }
    });
    setRelevantTxCount(currentRelevantTxCount);
    setCategorySpend(newCategorySpend);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Credit Card Cashback Tracker</h1>
      </header>
      <main>
        <div className="controls">
          <label htmlFor="card-select">Choose a Credit Card:</label>
          <select id="card-select" value={selectedCardId} onChange={handleCardChange}>
            <option value="">-- Select a Card --</option>
            {Object.keys(CARD_CONFIG).map(cardKey => (
              <option key={cardKey} value={cardKey}>
                {CARD_CONFIG[cardKey].name}
              </option>
            ))}
          </select>

          {selectedCardId && CARD_CONFIG[selectedCardId] && (
            <>
              <p className="info-text">
                Ensure your Excel file for <strong>{CARD_CONFIG[selectedCardId].name}</strong> has these columns:
                "{CARD_CONFIG[selectedCardId].columnMapping.date}",
                "{CARD_CONFIG[selectedCardId].columnMapping.account}",
                "{CARD_CONFIG[selectedCardId].columnMapping.description}",
                "{CARD_CONFIG[selectedCardId].columnMapping.amount}",
                "{CARD_CONFIG[selectedCardId].columnMapping.transactionType}".
              </p>
              <label htmlFor="file-upload">Upload Excel File (.xls, .xlsx):</label>
              <input
                type="file"
                id="file-upload"
                accept=".xls,.xlsx"
                onChange={handleFileChange}
              />
              <button onClick={processFile} disabled={!file || isLoading}>
                {isLoading ? 'Processing...' : 'Process File'}
              </button>
            </>
          )}
        </div>

        {error && <p className="error-message">{error}</p>}

        {categorySpend.length > 0 && (
          <div className="results">
            <h2>Cashback Status for {CARD_CONFIG[selectedCardId]?.name}</h2>
            {processedTxCount > 0 && (
              <p>
                Total rows in file: {processedTxCount}. Transactions relevant to this card & 'Expense' type: {relevantTxCount}.
              </p>
            )}

            <ul>
              {categorySpend.map(category => {
                const cashbackEarned = category.spent;
                const cashbackLimit = category.limit;
                // Handle cases where limit might be 0 or undefined to avoid division by zero
                const percentageOfLimitReached = cashbackLimit > 0 ? (cashbackEarned / cashbackLimit) * 100 : 0;

                return (
                  <li key={category.name}>
                    <strong>{category.name}</strong> (applies {category.percentage}% to transaction amount)
                    <div>
                      Cashback Earned: ₹ {cashbackEarned.toFixed(2)} / ₹ {cashbackLimit.toFixed(2)} Limit
                    </div>
                    <div className="progress-bar-container">
                      <div
                        className="progress-bar"
                        style={{
                          width: `${Math.min(percentageOfLimitReached, 100)}%`,
                          backgroundColor: percentageOfLimitReached >= 100 ? '#e74c3c' : '#2ecc71'
                        }}
                      ></div>
                    </div>
                    ({percentageOfLimitReached.toFixed(1)}% of cashback limit reached)
                    {percentageOfLimitReached >= 100 && <span className="limit-reached"> (LIMIT REACHED!)</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;