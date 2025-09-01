'use client'

import { ProcessingProgress } from '@/types'

interface ProgressTrackerProps {
  progress: ProcessingProgress
}

export default function ProgressTracker({ progress }: ProgressTrackerProps) {
  const steps = [
    { key: 'parsing', label: 'Parsing List', icon: '📝' },
    { key: 'searching_tier1', label: 'Exact Search', icon: '🎯' },
    { key: 'searching_tier2', label: 'Category Search', icon: '📂' },
    { key: 'searching_tier3', label: 'Alternative Search', icon: '🔄' },
    { key: 'quality_filter', label: 'Quality Filter', icon: '🤖' },
    { key: 'complete', label: 'Complete', icon: '✅' }
  ]

  const currentStepIndex = steps.findIndex(step => step.key === progress.step)

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900">Processing Your List</h3>
          <span className="text-sm text-gray-700">{progress.progress}%</span>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress.progress}%` }}
          ></div>
        </div>
      </div>

      {/* Step Indicators */}
      <div className="flex justify-between items-center mb-6">
        {steps.map((step, index) => (
          <div key={step.key} className="flex flex-col items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
              index < currentStepIndex 
                ? 'bg-green-100 text-green-600' 
                : index === currentStepIndex 
                  ? 'bg-blue-100 text-blue-600 animate-pulse' 
                  : 'bg-gray-100 text-gray-600'
            }`}>
              {step.icon}
            </div>
            <span className={`text-xs mt-2 text-center ${
              index <= currentStepIndex ? 'text-gray-800' : 'text-gray-600'
            }`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>

      {/* Current Status */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <p className="text-sm text-blue-800">
          <span className="font-medium">{progress.message}</span>
          {progress.currentItem && (
            <span className="block mt-1">
              Current item: {progress.currentItem}
            </span>
          )}
          {progress.totalItems && progress.processedItems !== undefined && (
            <span className="block mt-1">
              Items: {progress.processedItems}/{progress.totalItems}
            </span>
          )}
        </p>
      </div>
    </div>
  )
}