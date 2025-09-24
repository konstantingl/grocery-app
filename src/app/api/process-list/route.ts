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
  const startTime = Date.now();
  
  try {
    // Parse the request body with timeout
    const bodyPromise = request.json();
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Request body parsing timeout')), 5000)
    );
    
    const body: ProcessListRequest = await Promise.race([bodyPromise, timeoutPromise]);
    
    if (!body.shoppingList || typeof body.shoppingList !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Shopping list is required and must be a string' } as ProcessListResponse,
        { status: 400 }
      );
    }

    // Validate shopping list length
    if (body.shoppingList.length > 10000) {
      return NextResponse.json(
        { success: false, error: 'Shopping list is too long (max 10,000 characters)' } as ProcessListResponse,
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

    // Initialize the grocery service with timeout
    console.log('🔄 Initializing grocery service...');
    let service: GroceryService;
    
    try {
      const initPromise = initializeService();
      const initTimeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Service initialization timeout')), 10000)
      );
      service = await Promise.race([initPromise, initTimeoutPromise]);
    } catch (error) {
      console.error('❌ Service initialization failed:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to initialize grocery service. Please try again.' } as ProcessListResponse,
        { status: 503 }
      );
    }
    
    // Process the shopping list with timeout (25 seconds for Vercel)
    console.log('🛒 Processing shopping list request');
    const processingPromise = service.processShoppingList(body.shoppingList);
    const processingTimeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Processing timeout - request took too long')), 25000)
    );
    
    const result = await Promise.race([processingPromise, processingTimeoutPromise]);
    
    // Log processing time
    const processingTime = Date.now() - startTime;
    console.log(`⏱️ Processing completed in ${processingTime}ms`);
    
    // Return the result
    const response: ProcessListResponse = {
      success: true,
      result
    };

    return NextResponse.json(response);

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`❌ Error processing shopping list (${processingTime}ms):`, error);
    
    let errorMessage = 'An error occurred processing your list. Please try again.';
    let statusCode = 500;
    
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        errorMessage = 'The request took too long to process. Please try with a shorter shopping list or try again later.';
        statusCode = 408; // Request Timeout
      } else if (error.message.includes('parsing timeout')) {
        errorMessage = 'Failed to parse request. Please check your input and try again.';
        statusCode = 400; // Bad Request
      } else if (error.message.includes('OpenAI') || error.message.includes('API')) {
        errorMessage = 'AI service is temporarily unavailable. Please try again in a moment.';
        statusCode = 503; // Service Unavailable
      } else if (error.message.includes('products')) {
        errorMessage = 'Product database is temporarily unavailable. Please try again.';
        statusCode = 503;
      }
    }
    
    // Return error response
    const errorResponse: ProcessListResponse = {
      success: false,
      error: errorMessage
    };

    return NextResponse.json(errorResponse, { status: statusCode });
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