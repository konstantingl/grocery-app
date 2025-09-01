'use client'

import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'

interface HeaderProps {
  title?: string
  subtitle?: string
}

export default function Header({ 
  title = '🛒 Smart Grocery Shopping',
  subtitle = 'Enter your shopping list and get matched REWE products with URLs'
}: HeaderProps) {
  const { user, signOut, loading } = useAuth()

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              <Link href="/" className="hover:text-blue-600 transition-colors">
                {title}
              </Link>
            </h1>
            <p className="mt-2 text-gray-700">
              {subtitle}
            </p>
          </div>

          {user && (
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-4">
                <Link
                  href="/my-lists"
                  className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
                >
                  My Lists
                </Link>
                <span className="text-sm text-gray-800">
                  {user.email}
                </span>
              </div>
              
              <button
                onClick={() => signOut()}
                disabled={loading}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Signing out...' : 'Sign out'}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}