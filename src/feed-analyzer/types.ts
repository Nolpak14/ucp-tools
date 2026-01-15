/**
 * Product Feed Quality Analyzer Types
 * Deep analysis of product data quality for AI agent visibility
 */

/**
 * Severity levels for feed issues
 */
export type IssueSeverity = 'critical' | 'warning' | 'info';

/**
 * Categories of feed quality checks
 */
export type CheckCategory =
    | 'completeness'
    | 'identifiers'
    | 'images'
    | 'pricing'
    | 'descriptions'
    | 'categories'
    | 'availability';

/**
 * Individual product data from Schema.org JSON-LD
 */
export interface ProductData {
    name?: string;
    description?: string;
    sku?: string;
    gtin?: string;
    gtin8?: string;
    gtin12?: string;
    gtin13?: string;
    gtin14?: string;
    mpn?: string;
    brand?: string | { name?: string };
    image?: string | string[] | { url?: string }[];
    offers?: ProductOffer | ProductOffer[];
    category?: string;
    color?: string;
    size?: string;
    material?: string;
    weight?: string | { value?: number; unitCode?: string };
    aggregateRating?: {
        ratingValue?: number;
        reviewCount?: number;
        ratingCount?: number;
    };
    review?: unknown[];
    url?: string;
    '@type'?: string;
}

/**
 * Product offer/pricing data
 */
export interface ProductOffer {
    '@type'?: string;
    price?: number | string;
    priceCurrency?: string;
    availability?: string;
    url?: string;
    seller?: { name?: string };
    priceValidUntil?: string;
    itemCondition?: string;
    shippingDetails?: unknown;
}

/**
 * Individual quality check result
 */
export interface QualityCheck {
    id: string;
    name: string;
    category: CheckCategory;
    passed: boolean;
    severity: IssueSeverity;
    message: string;
    details?: string;
    recommendation?: string;
    affectedProducts?: string[];
}

/**
 * Product-level analysis result
 */
export interface ProductAnalysis {
    name: string;
    url?: string;
    sku?: string;
    score: number;
    issues: QualityCheck[];
    attributes: {
        hasName: boolean;
        hasDescription: boolean;
        hasSku: boolean;
        hasGtin: boolean;
        hasBrand: boolean;
        hasImage: boolean;
        hasPrice: boolean;
        hasAvailability: boolean;
        hasCategory: boolean;
        descriptionLength: number;
        imageCount: number;
    };
}

/**
 * Category scores breakdown
 */
export interface CategoryScores {
    completeness: number;
    identifiers: number;
    images: number;
    pricing: number;
    descriptions: number;
    categories: number;
    availability: number;
}

/**
 * Overall feed analysis result
 */
export interface FeedAnalysisResult {
    url: string;
    analyzedAt: string;
    productsFound: number;
    productsAnalyzed: number;
    overallScore: number;
    agentVisibilityScore: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    categoryScores: CategoryScores;
    issues: QualityCheck[];
    topIssues: QualityCheck[];
    products: ProductAnalysis[];
    recommendations: Recommendation[];
    summary: FeedSummary;
}

/**
 * Recommendation for improving feed quality
 */
export interface Recommendation {
    priority: 'high' | 'medium' | 'low';
    category: CheckCategory;
    title: string;
    description: string;
    impact: string;
    affectedCount: number;
}

/**
 * Summary statistics for the feed
 */
export interface FeedSummary {
    totalProducts: number;
    withName: number;
    withDescription: number;
    withSku: number;
    withGtin: number;
    withBrand: number;
    withImages: number;
    withPrice: number;
    withAvailability: number;
    withCategory: number;
    averageDescriptionLength: number;
    averageImageCount: number;
}

/**
 * Input options for feed analysis
 */
export interface FeedAnalysisInput {
    url: string;
    maxProducts?: number;
    includeProductDetails?: boolean;
}

/**
 * GTIN validation result
 */
export interface GtinValidation {
    isValid: boolean;
    type?: 'GTIN-8' | 'GTIN-12' | 'GTIN-13' | 'GTIN-14' | 'UPC' | 'EAN';
    error?: string;
}

/**
 * Quality check definitions
 */
export const QUALITY_CHECKS: Record<string, {
    name: string;
    category: CheckCategory;
    severity: IssueSeverity;
    description: string;
}> = {
    // Completeness checks
    'missing-name': {
        name: 'Missing Product Name',
        category: 'completeness',
        severity: 'critical',
        description: 'Product name is required for AI agents to identify products',
    },
    'missing-description': {
        name: 'Missing Description',
        category: 'completeness',
        severity: 'warning',
        description: 'Product description helps AI agents understand and recommend products',
    },
    'short-description': {
        name: 'Short Description',
        category: 'descriptions',
        severity: 'info',
        description: 'Longer descriptions provide better context for AI agents',
    },
    'missing-brand': {
        name: 'Missing Brand',
        category: 'completeness',
        severity: 'warning',
        description: 'Brand information helps with product identification and search',
    },

    // Identifier checks
    'missing-sku': {
        name: 'Missing SKU',
        category: 'identifiers',
        severity: 'warning',
        description: 'SKU helps uniquely identify products in your catalog',
    },
    'missing-gtin': {
        name: 'Missing GTIN/UPC/EAN',
        category: 'identifiers',
        severity: 'warning',
        description: 'Global identifiers enable cross-platform product matching',
    },
    'invalid-gtin': {
        name: 'Invalid GTIN Format',
        category: 'identifiers',
        severity: 'critical',
        description: 'GTIN has invalid format or check digit',
    },

    // Image checks
    'missing-image': {
        name: 'Missing Product Image',
        category: 'images',
        severity: 'critical',
        description: 'Product images are essential for AI shopping experiences',
    },
    'single-image': {
        name: 'Single Image Only',
        category: 'images',
        severity: 'info',
        description: 'Multiple images improve product presentation',
    },
    'missing-image-alt': {
        name: 'Missing Image Alt Text',
        category: 'images',
        severity: 'info',
        description: 'Alt text helps with accessibility and SEO',
    },

    // Pricing checks
    'missing-price': {
        name: 'Missing Price',
        category: 'pricing',
        severity: 'critical',
        description: 'Price is required for AI agents to complete purchases',
    },
    'missing-currency': {
        name: 'Missing Currency',
        category: 'pricing',
        severity: 'warning',
        description: 'Currency must be specified for international commerce',
    },
    'invalid-price': {
        name: 'Invalid Price Format',
        category: 'pricing',
        severity: 'critical',
        description: 'Price must be a valid number',
    },

    // Availability checks
    'missing-availability': {
        name: 'Missing Availability',
        category: 'availability',
        severity: 'warning',
        description: 'Availability status helps AI agents make purchase decisions',
    },
    'invalid-availability': {
        name: 'Invalid Availability Value',
        category: 'availability',
        severity: 'warning',
        description: 'Availability should use Schema.org ItemAvailability values',
    },

    // Category checks
    'missing-category': {
        name: 'Missing Category',
        category: 'categories',
        severity: 'info',
        description: 'Product categorization improves discoverability',
    },
};

/**
 * Valid Schema.org availability values
 */
export const VALID_AVAILABILITY_VALUES = [
    'https://schema.org/InStock',
    'https://schema.org/OutOfStock',
    'https://schema.org/PreOrder',
    'https://schema.org/PreSale',
    'https://schema.org/SoldOut',
    'https://schema.org/InStoreOnly',
    'https://schema.org/OnlineOnly',
    'https://schema.org/LimitedAvailability',
    'https://schema.org/Discontinued',
    'https://schema.org/BackOrder',
    'InStock',
    'OutOfStock',
    'PreOrder',
    'PreSale',
    'SoldOut',
    'InStoreOnly',
    'OnlineOnly',
    'LimitedAvailability',
    'Discontinued',
    'BackOrder',
];

/**
 * Scoring weights for different categories
 */
export const CATEGORY_WEIGHTS: Record<CheckCategory, number> = {
    completeness: 25,
    identifiers: 15,
    images: 20,
    pricing: 20,
    descriptions: 10,
    categories: 5,
    availability: 5,
};

/**
 * Grade thresholds
 */
export const GRADE_THRESHOLDS = {
    A: 90,
    B: 75,
    C: 60,
    D: 40,
    F: 0,
};
