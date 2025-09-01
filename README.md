# 🛒 Smart Grocery Shopping App

An AI-powered grocery shopping application that takes natural language shopping lists and returns matched REWE products with URLs and smart quantity calculations.

## Features

- **AI-Powered Parsing**: Understands natural language shopping lists with quantities, attributes (organic, fresh, etc.)
- **Multi-Tier Search**: Uses sophisticated 3-tier search strategy (exact → category → alternatives)
- **Smart Matching**: Category filtering prevents wrong matches (fresh vs. canned products)
- **Quantity Calculation**: Intelligent quantity calculations considering package sizes and perishability
- **Quality Filtering**: LLM-powered quality assessment and re-ranking of product matches
- **German Translation**: Automatically translates items to German for REWE product matching

## Technology Stack

- **Frontend**: Next.js 15 with TypeScript and Tailwind CSS
- **AI**: OpenAI GPT-4o-mini for parsing and quality filtering
- **Data**: 5000+ REWE products with categories, prices, and URLs
- **Architecture**: Full-stack Next.js with API routes

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env.local
   # Add your OpenAI API key to .env.local
   ```

3. **Add your REWE products data**:
   - Place your `rewe_all_products.json` file in the `src/data/` directory
   - Or place it in the root directory
   - The app will automatically load it on startup

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Open [http://localhost:3000](http://localhost:3000)** in your browser

## Usage

1. Enter your shopping list in natural language, for example:
   ```
   2 avocados
   250g cherry tomatoes
   whole wheat pasta
   organic milk
   firm tofu
   ```

2. Click "Find Products" to process your list

3. View the matched REWE products with:
   - Direct purchase URLs
   - Calculated quantities and prices
   - Match quality indicators
   - Alternative options

## How It Works

### 1. AI Parsing
The system uses OpenAI to parse your natural language shopping list, extracting:
- Base item names (translated to German)
- Quantities and units
- Specific attributes (organic, whole wheat, fresh, etc.)
- Item categorization for smart matching

### 2. Multi-Tier Search
Products are found using a sophisticated 3-tier search:
- **Tier 1**: Exact/specific matches with all attributes
- **Tier 2**: Category-level matches without qualifiers
- **Tier 3**: Alternative/substitute products

### 3. Category Filtering
Each search tier includes strict category filtering to prevent incorrect matches:
- Fresh produce → "Obst & Gemüse"
- Canned goods → "Fertiggerichte & Konserven"
- Dairy → "Käse, Eier & Molkerei"
- etc.

### 4. Smart Scoring
Products are scored based on:
- Keyword matches (exact word, compound word, substring)
- Tier weighting (3x for tier1, 1.5x for tier2, 0.8x for tier3)
- Attribute bonuses (bio, vollkorn, fresh, etc.)
- Size appropriateness

### 5. Quality Filtering
An AI quality filter evaluates candidates and re-ranks them based on:
- Attribute matching accuracy
- Package size appropriateness  
- Fresh vs. processed preference
- Category correctness

### 6. Quantity Calculation
Intelligent quantity calculation considers:
- Package sizes and unit conversions
- Perishability factors
- Economic efficiency
- Practical usage patterns

## Data Format

Your `rewe_all_products.json` should contain an array of products:

```json
[
  {
    "category": "Obst & Gemüse",
    "title": "Bio Avocados, 2 Stück",
    "price": 2.99,
    "volume": "2 Stück",
    "url": "https://shop.rewe.de/p/bio-avocados-2-stueck/1234567"
  }
]
```

## Environment Variables

```env
OPENAI_API_KEY=your_openai_api_key_here
NODE_ENV=development
```

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production  
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Authentication & Saved Lists

This app includes user authentication and the ability to save shopping lists:

- **Authentication**: Email/password login using Supabase Auth
- **Saved Lists**: Store and manage multiple shopping lists in the database
- **User Management**: Secure user sessions with Row Level Security

### Setup Authentication

1. Follow instructions in `SUPABASE_SETUP.md` to configure your Supabase database
2. Set up the required environment variables
3. Deploy using the instructions in `DEPLOYMENT.md`

## Deployment

This app is ready for deployment on Vercel with GitHub integration.

📖 **See `DEPLOYMENT.md` for complete deployment instructions**

🚀 **Live Demo:** Ready for deployment on Vercel

Key deployment features:
- Automatic GitHub integration
- Environment variable configuration
- Production-ready build settings
- Custom domain support

## Contributing

This application is based on sophisticated AI-powered grocery matching logic. The core algorithms include multi-tier search, category filtering, and intelligent quantity calculations designed specifically for German grocery shopping.
