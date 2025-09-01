'use client';

import { useState } from 'react';

interface GroceryListInputProps {
  onSubmit: (shoppingList: string) => void;
  loading: boolean;
  error: string | null;
}

export default function GroceryListInput({ onSubmit, loading, error }: GroceryListInputProps) {
  const [shoppingList, setShoppingList] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shoppingList.trim()) return;
    onSubmit(shoppingList);
  };

  const sampleList = `2 avocados
250g cherry tomatoes
whole wheat pasta
organic milk
firm tofu`;

  const loadSample = () => {
    setShoppingList(sampleList);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="shoppingList" className="block text-sm font-medium text-gray-900 mb-2">
            Enter your grocery list
          </label>
          <textarea
            id="shoppingList"
            rows={8}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter each item on a new line, e.g.:&#10;2 avocados&#10;250g cherry tomatoes&#10;whole wheat pasta&#10;organic milk"
            value={shoppingList}
            onChange={(e) => setShoppingList(e.target.value)}
            disabled={loading}
          />
          <p className="mt-2 text-sm text-gray-800">
            Enter each item on a new line. Be as specific as you want (quantities, brands, organic, etc.)
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Error processing your list
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center space-x-4">
          <button
            type="submit"
            disabled={loading || !shoppingList.trim()}
            className={`flex-1 flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
              loading || !shoppingList.trim()
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
            }`}
          >
            {loading ? (
              <div className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </div>
            ) : (
              '🛒 Find Products'
            )}
          </button>
          
          <button
            type="button"
            onClick={loadSample}
            disabled={loading}
            className="px-4 py-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-800 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Load Sample
          </button>
        </div>
      </form>

      <div className="mt-8 border-t border-gray-200 pt-6">
        <h3 className="text-sm font-medium text-gray-900 mb-3">How it works:</h3>
        <div className="space-y-2 text-sm text-gray-800">
          <div className="flex items-start">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium mr-3 mt-0.5">1</span>
            <p><strong>AI Parsing:</strong> Your list is analyzed to understand quantities, attributes (organic, fresh, etc.), and German translations</p>
          </div>
          <div className="flex items-start">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium mr-3 mt-0.5">2</span>
            <p><strong>Smart Matching:</strong> Multi-tier search finds the best REWE products using category filtering and quality scoring</p>
          </div>
          <div className="flex items-start">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium mr-3 mt-0.5">3</span>
            <p><strong>Quantity Calculation:</strong> Determines optimal purchase quantities considering package sizes and perishability</p>
          </div>
        </div>
      </div>
    </div>
  );
}