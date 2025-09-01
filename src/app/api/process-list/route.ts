import { NextRequest, NextResponse } from 'next/server';
import type { ProcessListRequest, ProcessListResponse } from '@/types';
import { GroceryService } from '@/lib/grocery-service';
import { loadProducts, validateProducts } from '@/lib/products-loader';

// Singleton instance
let groceryService: GroceryService | null = null;

// Initialize the service with products data
async function initializeService() {
  if (groceryService) {
    return groceryService;
  }

  try {
    console.log('🔄 Initializing grocery service...');
    
    // Load products from JSON file
    const products = loadProducts();
    
    // Validate products structure
    if (!validateProducts(products)) {
      throw new Error('Invalid products data structure');
    }

    console.log(`✅ Loaded and validated ${products.length} products`);
    
    groceryService = new GroceryService(products);
    return groceryService;
  } catch (error) {
    console.error('❌ Failed to initialize grocery service:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body: ProcessListRequest = await request.json();
    
    if (!body.shoppingList || typeof body.shoppingList !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Shopping list is required and must be a string' } as ProcessListResponse,
        { status: 400 }
      );
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'OpenAI API key not configured' } as ProcessListResponse,
        { status: 500 }
      );
    }

    // Initialize the grocery service
    const service = await initializeService();
    
    // Process the shopping list
    console.log('🛒 Processing shopping list request');
    const result = await service.processShoppingList(body.shoppingList);
    
    // Return the result
    const response: ProcessListResponse = {
      success: true,
      result
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error processing shopping list:', error);
    
    // Return error response
    const errorResponse: ProcessListResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// Handle OPTIONS for CORS if needed
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}