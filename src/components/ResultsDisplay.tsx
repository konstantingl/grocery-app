'use client';

import type { ShoppingResult, Product } from '@/types';
import ProductCard from '@/components/ProductCard';

interface ResultsDisplayProps {
  results: ShoppingResult;
}

export default function ResultsDisplay({ results }: ResultsDisplayProps) {
  const formatPrice = (price: number) => `€${price.toFixed(2)}`;

  return (
    <div className="space-y-6">
      {/* Summary */}
      {results.summary && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{results.summary.itemsFound}</div>
              <div className="text-sm text-gray-700">Items Found</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{results.summary.itemsNotFound}</div>
              <div className="text-sm text-gray-700">Not Found</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{formatPrice(results.totalCost)}</div>
              <div className="text-sm text-gray-700">Total Cost</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{results.summary.successRate.toFixed(1)}%</div>
              <div className="text-sm text-gray-700">Success Rate</div>
            </div>
          </div>
        </div>
      )}

      {/* Found Items */}
      {results.foundItems.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            🛒 Shopping List ({results.foundItems.length} items)
          </h3>
          <div className="space-y-4">
            {results.foundItems.map((item, index) => {
              // Find alternatives for this item by matching the original shopping list items
              let itemAlternatives: Array<{ product: Product; score: number; tier: string }> = []
              
              if (results.candidatesConsidered) {
                // Try to find alternatives by looking for entries where the selected product matches
                const matchingEntry = Object.entries(results.candidatesConsidered).find(([_originalText, candidates]) => {
                  // Check if any candidate in this entry matches our selected item
                  return candidates.some(candidate => 
                    candidate.product.title === item.product.title ||
                    candidate.product.url === item.product.url
                  )
                })
                
                if (matchingEntry) {
                  itemAlternatives = matchingEntry[1]
                }
              }

              return (
                <ProductCard
                  key={index}
                  item={item}
                  index={index}
                  alternatives={itemAlternatives}
                  onSelectAlternative={(product) => {
                    // TODO: Implement alternative selection
                    console.log('Selected alternative:', product)
                  }}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Not Found Items */}
      {results.notFound.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-red-600 mb-4">
            ❌ Items Not Found ({results.notFound.length})
          </h3>
          <div className="space-y-2">
            {results.notFound.map((item, index) => (
              <div key={index} className="p-3 bg-red-50 border border-red-200 rounded text-red-700">
                {item}
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-gray-700">
            These items couldn&apos;t be matched with available products. Try being more or less specific, or check for spelling variations.
          </p>
        </div>
      )}

    </div>
  );
}