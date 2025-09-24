'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AuthForm from '@/components/AuthForm';
import GroceryListInput from '@/components/GroceryListInput';
import ResultsDisplay from '@/components/ResultsDisplay';
import Header from '@/components/Header';
import ProgressTracker from '@/components/ProgressTracker';
import type { ShoppingResult, ProcessingProgress } from '@/types';

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [results, setResults] = useState<ShoppingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProcessingProgress | null>(null);
  const currentRequestRef = useRef<AbortController | null>(null);

  const handleProcessList = async (shoppingList: string) => {
    // Cancel any existing request
    if (currentRequestRef.current) {
      currentRequestRef.current.abort();
      currentRequestRef.current = null;
    }
    
    setLoading(true);
    setError(null);
    setResults(null);
    setProgress(null);

    // Simulate progress steps
    const simulateProgress = () => {
      const steps: ProcessingProgress[] = [
        {
          step: 'parsing',
          message: 'Analyzing your shopping list with AI...',
          progress: 10
        },
        {
          step: 'searching_tier1',
          message: 'Searching for exact matches...',
          progress: 30
        },
        {
          step: 'searching_tier2',
          message: 'Expanding to category matches...',
          progress: 50
        },
        {
          step: 'searching_tier3',
          message: 'Looking for alternatives...',
          progress: 70
        },
        {
          step: 'quality_filter',
          message: 'Applying AI quality filtering...',
          progress: 90
        }
      ];

      let currentStep = 0;
      const interval = setInterval(() => {
        if (currentStep < steps.length) {
          setProgress(steps[currentStep]);
          currentStep++;
        } else {
          clearInterval(interval);
        }
      }, 800);

      return interval;
    };

    const progressInterval = simulateProgress();

    try {
      // Create AbortController only for user cancellation (no timeout)
      const controller = new AbortController();
      currentRequestRef.current = controller;

      const response = await fetch('/api/process-list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ shoppingList }),
        signal: controller.signal,
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response. Please try again.');
      }

      const data = await response.json();

      // Clear progress simulation
      clearInterval(progressInterval);

      if (data.success && data.result) {
        setProgress({
          step: 'complete',
          message: 'Processing complete!',
          progress: 100
        });
        
        // Show complete state briefly, then show results
        setTimeout(() => {
          setResults(data.result);
          setProgress(null);
        }, 800);
      } else {
        setError(data.error || 'An error occurred processing your list');
        setProgress(null);
      }
    } catch (err) {
      clearInterval(progressInterval);
      console.error('Error processing grocery list:', err);
      
      let errorMessage = 'Failed to process your shopping list. Please try again.';
      
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          // This is caused by user navigation, page refresh, or component unmounting
          console.log('Request was cancelled (this is normal if you navigated away)');
          errorMessage = 'Request was cancelled. If you did not navigate away, please try again.';
        } else if (err.message.includes('non-JSON response')) {
          errorMessage = err.message;
        } else if (err.message.includes('Server error')) {
          errorMessage = 'Server is experiencing issues. Please try again in a moment.';
        } else if (err.message.includes('Failed to fetch')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        }
      }
      
      setError(errorMessage);
      setProgress(null);
    } finally {
      // Cleanup
      clearInterval(progressInterval);
      // Clear the current request ref
      if (currentRequestRef.current) {
        currentRequestRef.current = null;
      }
      setLoading(false);
    }
  };

  const handleClear = () => {
    setResults(null);
    setError(null);
  };

  const toggleAuthMode = () => {
    setAuthMode(authMode === 'login' ? 'signup' : 'login');
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-gray-700">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {!user ? (
          <div className="max-w-md mx-auto">
            <AuthForm mode={authMode} onToggleMode={toggleAuthMode} />
          </div>
        ) : progress ? (
          <ProgressTracker progress={progress} />
        ) : !results ? (
          <GroceryListInput
            onSubmit={handleProcessList}
            loading={loading}
            error={error}
          />
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-gray-900">
                Shopping Results
              </h2>
              <div className="flex space-x-3">
                <button
                  onClick={handleClear}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  New List
                </button>
                <button
                  onClick={() => {/* TODO: Save list functionality */}}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Save List
                </button>
              </div>
            </div>
            
            <ResultsDisplay results={results} />
          </div>
        )}
      </main>

      <footer className="mt-16 border-t border-gray-200 bg-white">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <p className="text-center text-gray-800 text-sm">
            AI-powered grocery shopping with multi-tier matching and smart quantity calculation
          </p>
        </div>
      </footer>
    </div>
  );
}