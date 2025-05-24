// src/App.js
import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { CARD_CONFIG, getInitialCategorySpending } from './cardConfig';
import './App.css';

const formatDate = (dateObj) => {
  if (dateObj instanceof Date && !isNaN(dateObj)) {
    return dateObj.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }
  if (typeof dateObj === 'number') {
    try {
      const d = XLSX.SSF.parse_date_code(dateObj);
      if (d) {
        return new Date(d.y, d.m - 1, d.d, d.H, d.M, d.S).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
      }
    } catch (e) {
      console.warn("Could not parse numeric date:", dateObj, e);
    }
  }
  if (dateObj) return String(dateObj);
  return 'N/A';
};

function App() {
  const [selectedCardId, setSelectedCardId] = useState('');
  const [file, setFile] = useState(null);
  const [categorySpend, setCategorySpend] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [processedTxCount, setProcessedTxCount] = useState(0);
  const [relevantTxCount, setRelevantTxCount] = useState(0);
  const [expandedCategories, setExpandedCategories] = useState({});

  useEffect(() => {
    if (selectedCardId) {
      setCategorySpend(getInitialCategorySpending(selectedCardId));
      setProcessedTxCount(0);
      setRelevantTxCount(0);
      setExpandedCategories({});
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

  const toggleCategoryTransactions = (categoryName) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryName]: !prev[categoryName]
    }));
  };

  const processFile = () => {
    console.log("--- processFile initiated ---");

    if (!file || !selectedCardId) {
      console.warn("Aborted: File or selectedCardId missing.", { file, selectedCardId });
      setError('Please select a card and upload a file first.');
      return;
    }

    setIsLoading(true);
    setError('');
    setProcessedTxCount(0);
    setRelevantTxCount(0);
    // CRITICAL: Reset categorySpend to a fresh state based on the currently selected card
    // This prevents accumulation or stale data from previous attempts or different cards.
    setCategorySpend(getInitialCategorySpending(selectedCardId));
    setExpandedCategories({});
    console.log("State reset. isLoading: true. Initial categorySpend:", JSON.parse(JSON.stringify(getInitialCategorySpending(selectedCardId))));


    const reader = new FileReader();

    reader.onload = (e) => {
      console.log("FileReader onload: File read into memory.");
      try {
        const data = new Uint8Array(e.target.result);
        console.log("File data (Uint8Array) length:", data.byteLength);

        const workbook = XLSX.read(data, { type: 'array', cellDates: true, dense: false }); // `dense: false` can sometimes help with sparse sheets
        console.log("Workbook parsed. Available Sheet names:", workbook.SheetNames);

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            console.error("Error: No sheets found in the workbook.");
            setError("No sheets found in the Excel file. Ensure it's not empty, corrupted, or password-protected.");
            setIsLoading(false);
            return;
        }

        let jsonData = [];
        let foundData = false;
        let sheetNameUsed = "";

        for (const name of workbook.SheetNames) {
            console.log(`Attempting to process sheet: '${name}'`);
            const worksheet = workbook.Sheets[name];
            if (!worksheet) {
                console.warn(`Sheet named '${name}' is undefined in workbook.Sheets collection. Skipping.`);
                continue;
            }

            // Log the raw worksheet object - can be large, but useful for deep debug
            // console.log(`Raw worksheet object for sheet '${name}':`, worksheet);
            if (worksheet['!ref']) {
                console.log(`Sheet '${name}' !ref (data range reported by xlsx): ${worksheet['!ref']}`);
            } else {
                console.warn(`Sheet '${name}' does not have a '!ref' property. This often indicates an empty sheet or a parsing issue where xlsx couldn't determine data boundaries.`);
            }

            // Attempt 1: Recommended options (raw:false for formatted values with cellDates:true)
            // defval: "" ensures empty cells are included as empty strings, which helps with consistent object keys.
            let currentSheetJsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: "" });
            console.log(`Sheet '${name}' - Attempt 1 (raw:false, defval:""): ${currentSheetJsonData.length} rows extracted.`);

            if (currentSheetJsonData.length > 0) {
                jsonData = currentSheetJsonData;
                sheetNameUsed = name;
                console.log(`SUCCESS: Found ${jsonData.length} rows in sheet '${sheetNameUsed}' using Attempt 1.`);
                if (jsonData.length > 0) console.log("First row sample (Attempt 1):", JSON.stringify(jsonData[0]));
                foundData = true;
                break; // Use the first sheet that yields data
            } else {
                // Attempt 2: Simpler options (default raw:true, but keep defval:"")
                console.log(`Sheet '${name}' - Attempt 1 yielded 0 rows. Trying Attempt 2 (default raw, defval:"")...`);
                currentSheetJsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
                console.log(`Sheet '${name}' - Attempt 2 (default raw, defval:""): ${currentSheetJsonData.length} rows extracted.`);
                if (currentSheetJsonData.length > 0) {
                    jsonData = currentSheetJsonData;
                    sheetNameUsed = name;
                    console.log(`SUCCESS: Found ${jsonData.length} rows in sheet '${sheetNameUsed}' using Attempt 2.`);
                    if (jsonData.length > 0) console.log("First row sample (Attempt 2):", JSON.stringify(jsonData[0]));
                    foundData = true;
                    break;
                } else {
                     console.log(`Sheet '${name}' - Attempt 2 also yielded 0 rows.`);
                }
            }
        }

        if (!foundData) {
            console.error("Critical Error: No data rows found in any sheet after trying multiple parsing methods.");
            setError("Could not extract data rows from any sheet. The file might be empty, have an unusual format, or the data isn't in a table structure starting near the top. Check console for sheet details.");
            setIsLoading(false);
            return;
        }

        console.log(`Proceeding with data from sheet: '${sheetNameUsed}'. Total rows: ${jsonData.length}`);
        setProcessedTxCount(jsonData.length);

        const cardConfig = CARD_CONFIG[selectedCardId];
        if (!cardConfig) {
            console.error("Configuration Error: Selected card configuration not found for ID:", selectedCardId);
            setError("Invalid card selection. Configuration missing. Please check cardConfig.js.");
            setIsLoading(false);
            return;
        }
        console.log("Using card config for:", cardConfig.name);

        const {
          date: dateCol, account: accountCol, category: excelCategoryCol,
          subcategory: excelSubcategoryCol, description: descCol,
          amount: amountCol, transactionType: transTypeCol
        } = cardConfig.columnMapping;

        // Column validation only makes sense if jsonData has rows
        if (jsonData.length > 0) {
          const firstRow = jsonData[0]; // These are the headers xlsx derived
          const actualHeaders = Object.keys(firstRow);
          console.log(`Headers found by XLSX in sheet '${sheetNameUsed}':`, actualHeaders.join(", "));

          const missingColumns = [];
          if (!actualHeaders.includes(dateCol)) missingColumns.push(dateCol);
          if (!actualHeaders.includes(accountCol)) missingColumns.push(accountCol);
          if (!actualHeaders.includes(excelCategoryCol)) missingColumns.push(`'${excelCategoryCol}' (Excel's Category)`);
          if (!actualHeaders.includes(excelSubcategoryCol)) missingColumns.push(`'${excelSubcategoryCol}' (Excel's Subcategory)`);
          if (!actualHeaders.includes(descCol)) missingColumns.push(`'${descCol}' (Note/Description)`);
          if (!actualHeaders.includes(amountCol)) missingColumns.push(amountCol);
          if (!actualHeaders.includes(transTypeCol)) missingColumns.push(transTypeCol);

          if (missingColumns.length > 0) {
            const errorMsg = `Column Mismatch: Expected columns not found in sheet '${sheetNameUsed}'. Missing: ${missingColumns.join(", ")}. Actual headers found: ${actualHeaders.join(", ")}. Please check your Excel file headers and cardConfig.js mapping.`;
            console.error(errorMsg, "First row data object:", JSON.stringify(firstRow));
            setError(errorMsg);
            setIsLoading(false);
            return;
          }
          console.log("Column validation passed for sheet:", sheetNameUsed);
        } else {
             // This should have been caught by !foundData, but as a final check.
             console.warn("Proceeding with column validation but jsonData is empty. This indicates an issue.");
             setError("Extracted an empty dataset despite initial positive check. Please verify file.");
             setIsLoading(false);
             return;
        }

        calculateSpending(jsonData, selectedCardId);
        console.log("calculateSpending completed.");

      } catch (err) {
        console.error("FATAL ERROR in processFile try-catch block:", err);
        setError(`Fatal error during file processing: ${err.message}. Check console for stack trace. The file might be severely corrupted or an unexpected library error occurred.`);
      } finally {
        console.log("FileReader onload finally block. Setting isLoading to false.");
        setIsLoading(false);
      }
    };

    reader.onerror = (err) => {
      console.error("FileReader.onerror event triggered:", err);
      setError('Error occurred while trying to read the file. It might be locked or inaccessible. Check console.');
      setIsLoading(false);
    };

    console.log("Calling reader.readAsArrayBuffer for file:", file ? file.name : "No file selected");
    if (file) {
      reader.readAsArrayBuffer(file);
    }
  };


  const calculateSpending = (allTransactions, cardId) => {
    console.log(`calculateSpending initiated for cardId: ${cardId} with ${allTransactions.length} transactions.`);
    const cardConfigData = CARD_CONFIG[cardId];
    if (!cardConfigData) {
        console.error("calculateSpending: Card config data not found for ID:", cardId);
        setError("Error in calculation: Card configuration is missing.");
        return; // Important to return to prevent further errors
    }

    // Critical: Make sure we start with a fresh category spend object from config
    const newCategorySpend = getInitialCategorySpending(cardId);
    console.log("Initial category spend structure for calculation:", JSON.parse(JSON.stringify(newCategorySpend)));


    const {
      date: dateCol, account: accountCol, category: excelCategoryCol,
      subcategory: excelSubcategoryCol, description: descCol,
      amount: amountCol, transactionType: transTypeCol
    } = cardConfigData.columnMapping;

    let currentRelevantTxCount = 0;

    allTransactions.forEach((row, index) => {
      // Robustly get values, defaulting to empty string if column is missing or value is null/undefined
      const transactionAccount = String(row[accountCol] || '').trim().toLowerCase();
      const cardAccountName = String(cardConfigData.name || '').trim().toLowerCase();
      const transactionType = String(row[transTypeCol] || '').trim().toLowerCase();

      if (transactionAccount !== cardAccountName || transactionType !== 'expense') {
        return; // Skip transaction
      }
      currentRelevantTxCount++;

      const descriptionText = String(row[descCol] || '').toLowerCase();
      let transactionAmountStr = String(row[amountCol] || '0');
      // Basic cleaning: remove common currency symbols and ALL commas. Then parse.
      // This assumes dot is the decimal separator. More complex international formats might need more.
      transactionAmountStr = transactionAmountStr.replace(/[$,€£¥]/g, '').replace(/,/g, '');
      const transactionAmount = parseFloat(transactionAmountStr);


      if (isNaN(transactionAmount) || transactionAmount <= 0) {
        // console.warn(`Skipping transaction due to invalid amount: Original='${row[amountCol]}', Cleaned='${transactionAmountStr}', Parsed='${transactionAmount}', Row Index=${index}, Desc='${descriptionText}'`);
        return;
      }

      for (const category of newCategorySpend) {
        // Ensure category.keywords is an array before trying to iterate
        if (!Array.isArray(category.keywords)) {
            console.warn(`Category '${category.name}' has invalid or missing 'keywords'. Skipping.`);
            continue;
        }
        for (const keyword of category.keywords) {
          if (descriptionText.includes(String(keyword || '').toLowerCase())) {
            const cashbackForThisTx = transactionAmount * (category.percentage / 100);
            category.spent += cashbackForThisTx;

            // Ensure contributingTransactions array exists
            if (!Array.isArray(category.contributingTransactions)) {
                category.contributingTransactions = [];
            }
            category.contributingTransactions.push({
              id: `${index}-${formatDate(row[dateCol]) || 'noDate'}-${transactionAmount}`,
              date: formatDate(row[dateCol]),
              excelCategory: String(row[excelCategoryCol] || 'N/A'),
              excelSubcategory: String(row[excelSubcategoryCol] || 'N/A'),
              description: String(row[descCol] || 'N/A'),
              amount: transactionAmount,
              cashbackEarned: cashbackForThisTx,
            });
            return;
          }
        }
      }
    });
    setRelevantTxCount(currentRelevantTxCount);
    setCategorySpend(newCategorySpend); // Update the main state
    console.log("Final categorySpend state after calculation:", JSON.parse(JSON.stringify(newCategorySpend)));
    console.log(`Calculation finished. Processed ${currentRelevantTxCount} relevant transactions.`);
  };

  // JSX remains the same as the previous "dark theme" version
  // ... (copy the return (...) part from the previous App.js version with dark theme) ...
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
                Ensure your Excel file for <strong>{CARD_CONFIG[selectedCardId].name}</strong> has columns:
                "{CARD_CONFIG[selectedCardId].columnMapping.date}",
                "{CARD_CONFIG[selectedCardId].columnMapping.account}",
                "{CARD_CONFIG[selectedCardId].columnMapping.category}" (Excel's Category),
                "{CARD_CONFIG[selectedCardId].columnMapping.subcategory}" (Excel's Subcategory),
                "{CARD_CONFIG[selectedCardId].columnMapping.description}" (Note/Description),
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
              <button onClick={processFile} disabled={isLoading || !file}> {/* Also disable if no file */}
                {isLoading ? 'Processing...' : 'Process File'}
              </button>
            </>
          )}
        </div>

        {error && <p className="error-message">{error}</p>}

        {categorySpend && categorySpend.length > 0 && !isLoading && ( // Check categorySpend has items before mapping
          <div className="results">
            <h2>Cashback Status for {CARD_CONFIG[selectedCardId]?.name}</h2>
            { (processedTxCount > 0 || relevantTxCount > 0 || (file && !isLoading)) && (
              <p>
                Total rows in file: {processedTxCount}. Transactions relevant to this card & 'Expense' type: {relevantTxCount}.
              </p>
            )}

            <ul>
              {categorySpend.map(category => {
                if(!category || typeof category.spent === 'undefined' || typeof category.limit === 'undefined'){
                    console.warn("Skipping rendering malformed category in JSX:", category);
                    return null;
                }
                const cashbackEarned = category.spent;
                const cashbackLimit = category.limit;
                const percentageOfLimitReached = cashbackLimit > 0 ? (cashbackEarned / cashbackLimit) * 100 : 0;

                return (
                  <li key={category.name} className="category-item">
                    <div className="category-summary">
                        <div>
                            <strong>{category.name}</strong> (applies {category.percentage}% to transaction amount)
                        </div>
                        <div>
                            Cashback Earned: ₹ {cashbackEarned.toFixed(2)} / ₹ {cashbackLimit.toFixed(2)} Limit
                        </div>
                        <div className="progress-bar-container">
                        <div
                            className="progress-bar"
                            style={{
                            width: `${Math.min(percentageOfLimitReached, 100)}%`,
                            backgroundColor: percentageOfLimitReached >= 100 ? '#c0392b' : '#27ae60'
                            }}
                        ></div>
                        </div>
                        ({percentageOfLimitReached.toFixed(1)}% of cashback limit reached)
                        {percentageOfLimitReached >= 100 && <span className="limit-reached"> (LIMIT REACHED!)</span>}
                    </div>

                    {category.contributingTransactions && category.contributingTransactions.length > 0 && (
                      <div className="transaction-details">
                        <button
                          onClick={() => toggleCategoryTransactions(category.name)}
                          className="toggle-transactions-btn"
                        >
                          {expandedCategories[category.name] ? 'Hide' : 'Show'} ({category.contributingTransactions.length}) Transactions
                        </button>
                        {expandedCategories[category.name] && (
                          <div className="transaction-list">
                            <table>
                              <thead>
                                <tr>
                                  <th>Date</th>
                                  <th>Description (Note)</th>
                                  <th>Excel Category</th>
                                  <th>Excel Subcategory</th>
                                  <th>Original Amount</th>
                                  <th>Cashback Earned</th>
                                </tr>
                              </thead>
                              <tbody>
                                {category.contributingTransactions.map((tx) => (
                                  <tr key={tx.id}>
                                    <td>{tx.date}</td>
                                    <td>{tx.description}</td>
                                    <td>{tx.excelCategory}</td>
                                    <td>{tx.excelSubcategory}</td>
                                    <td className="amount-column">₹ {tx.amount.toFixed(2)}</td>
                                    <td className="amount-column">₹ {tx.cashbackEarned.toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
         {!isLoading && selectedCardId && file && (!categorySpend || categorySpend.length === 0) && !error && processedTxCount > 0 && relevantTxCount === 0 &&(
            <p className="info-text">File processed. No cashback categories matched any relevant transactions from the uploaded file, or no relevant transactions found.</p>
        )}
        {!isLoading && selectedCardId && file && processedTxCount === 0 && !error && (
            <p className="info-text">The uploaded file was processed but contained no data rows, or no data could be extracted from any sheet.</p>
        )}
      </main>
    </div>
  );
}

export default App;