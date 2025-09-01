'use client'

import { useState } from 'react'
import type { ProductMatch, Product } from '@/types'

interface ProductCardProps {
  item: ProductMatch
  index: number
  alternatives?: Array<{ product: Product; score: number; tier: string }>
  onSelectAlternative?: (product: Product) => void
}

export default function ProductCard({ item, index: _index, alternatives = [], onSelectAlternative }: ProductCardProps) {
  const [showAlternatives, setShowAlternatives] = useState(false)

  const formatPrice = (price: number) => `€${price.toFixed(2)}`
  
  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'tier1':
        return 'bg-green-100 text-green-800'
      case 'tier2':
        return 'bg-yellow-100 text-yellow-800'
      case 'tier3':
        return 'bg-orange-100 text-orange-800'
      case 'ai_smart':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getTierLabel = (tier: string) => {
    switch (tier) {
      case 'tier1':
        return 'Exact Match'
      case 'tier2':
        return 'Category Match'
      case 'tier3':
        return 'Alternative'
      case 'ai_smart':
        return 'AI Calculated'
      default:
        return tier
    }
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="font-medium text-gray-900 mb-2">{item.product.title}</h4>
          <div className="flex items-center space-x-2 mb-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTierBadgeColor(item.matchTier)}`}>
              {getTierLabel(item.matchTier)}
            </span>
            <span className="text-sm text-gray-700">
              Confidence: {(item.confidence * 10).toFixed(1)}/10
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-700">
            <div>
              <span className="font-medium">Quantity:</span> {item.unitsNeeded} units
            </div>
            <div>
              <span className="font-medium">Total Amount:</span> {item.actualAmount}{item.actualUnit}
            </div>
            <div>
              <span className="font-medium">Category:</span> {item.product.category}
            </div>
          </div>

          {item.matchReasoning && (
            <div className="mt-2 p-3 bg-gray-50 rounded text-sm text-gray-700">
              <span className="font-medium">Reasoning:</span> {item.matchReasoning}
            </div>
          )}

          {/* Alternatives Section */}
          {alternatives.length > 1 && (
            <div className="mt-3 border-t border-gray-200 pt-3">
              <button
                onClick={() => setShowAlternatives(!showAlternatives)}
                className="flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-800 transition-colors"
              >
                <span>View {alternatives.length - 1} alternatives</span>
                <svg 
                  className={`w-4 h-4 transform transition-transform ${showAlternatives ? 'rotate-180' : ''}`} 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showAlternatives && (
                <div className="mt-2 space-y-2">
                  {alternatives.slice(1).map((alt, altIndex) => (
                    <div key={altIndex} className="p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <span className="font-medium text-gray-900">{alt.product.title}</span>
                          <div className="text-gray-700 mt-1">
                            {formatPrice(alt.product.price)} | Score: {alt.score.toFixed(2)} | {getTierLabel(alt.tier)}
                          </div>
                        </div>
                        <div className="flex space-x-2 ml-2">
                          <button
                            onClick={() => onSelectAlternative?.(alt.product)}
                            className="px-2 py-1 text-xs font-medium text-blue-600 bg-white border border-blue-200 rounded hover:bg-blue-50 transition-colors"
                          >
                            Select
                          </button>
                          <a
                            href={alt.product.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors"
                          >
                            View
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="ml-4 text-right">
          <div className="text-lg font-bold text-gray-900">
            {formatPrice(item.totalPrice)}
          </div>
          <div className="text-sm text-gray-700">
            {formatPrice(item.product.price)} per unit
          </div>
        </div>
      </div>
      
      <div className="mt-4 pt-3 border-t border-gray-200">
        <a
          href={item.product.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        >
          🛍️ Buy on REWE
          <svg className="ml-2 -mr-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    </div>
  )
}