// Core data models for the grocery shopping system

// Auth types
export interface User {
  id: string;
  email: string;
}

// Database types
export interface SavedShoppingList {
  id: string;
  user_id: string;
  name: string;
  original_list: string;
  created_at: string;
  updated_at: string;
}

export interface ProcessingProgress {
  step: 'parsing' | 'searching_tier1' | 'searching_tier2' | 'searching_tier3' | 'quality_filter' | 'complete';
  message: string;
  progress: number; // 0-100
  currentItem?: string;
  totalItems?: number;
  processedItems?: number;
}

export interface Product {
  category: string;
  title: string;
  price: number;
  volume: string;
  url: string;
}

export interface ShoppingItem {
  item: string;
  amount: number;
  unit: string;
  originalText: string;
  attributes: string[];
  alternatives: string[];
  itemType: 'fresh_produce' | 'dry_goods' | 'dairy' | 'meat' | 'herbs_spices' | 'canned' | 'condiments' | 'unknown';
}

export interface SearchTiers {
  tier1: string[]; // Exact/specific matches
  tier2: string[]; // Category matches
  tier3: string[]; // Alternative matches
}

export interface ProductMatch {
  product: Product;
  unitsNeeded: number;
  actualAmount: number;
  actualUnit: string;
  totalPrice: number;
  confidence: number;
  matchTier: string;
  matchReasoning?: string;
}

export interface ShoppingResult {
  foundItems: ProductMatch[];
  notFound: string[];
  totalCost: number;
  timestamp: string;
  originalList: string;
  candidatesConsidered?: Record<string, Array<{
    product: Product;
    score: number;
    tier: string;
  }>>;
  summary?: {
    totalItemsRequested: number;
    itemsFound: number;
    itemsNotFound: number;
    successRate: number;
  };
}

// API request/response types
export interface ProcessListRequest {
  shoppingList: string;
}

export interface ProcessListResponse {
  success: boolean;
  result?: ShoppingResult;
  error?: string;
}

// OpenAI API types
export interface ParsedShoppingList {
  items: Array<{
    item: string;
    amount: number;
    unit: string;
    original: string;
    attributes?: string[];
    alternatives?: string[];
    item_type: string;
  }>;
}

export interface CategorySelection {
  categories: string[];
  reasoning: string;
}

export interface SearchTiersResult {
  tier1: string[];
  tier2: string[];
  tier3: string[];
}

export interface QualityFilterResult {
  selectedCandidates: Array<{
    index: number;
    reasoning: string;
  }>;
  overallReasoning: string;
}

export interface SmartQuantityResult {
  unitsNeeded: number;
  actualAmount: number;
  actualUnit: string;
  reasoning: string;
  overageAcceptable?: boolean;
}