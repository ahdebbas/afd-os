export const SAMPLE_FINANCE = {
  version: 4,
  properties: [{ id: 'test-property', name: 'Example apartment', location: 'Example City', purchaseValue: null, currentValue: 120000 }],
  msft: { shares: 12, price: 90 },
  sarwaTrade: {
    lastUpdated: null,
    holdings: [
      { ticker: 'GOOGL', name: 'Alphabet', units: 4, recordedUnits: 4, price: 250, value: 1000 },
      { ticker: 'NVDA', name: 'NVIDIA', units: 6, recordedUnits: 6, price: 150, value: 900 },
      { ticker: 'SPTE', name: 'Example ETF', units: 8, recordedUnits: 8, price: 25, value: 200 },
    ],
  },
  sarwa: {
    lastUpdated: null,
    holdings: [
      { ticker: 'ISDW', name: 'Example fund', units: 5, cost: 200, value: 300 },
      { ticker: 'USD', name: 'Cash', value: 50, perf: 0 },
    ],
  },
}
