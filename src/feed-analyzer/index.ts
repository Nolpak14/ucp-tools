/**
 * Product Feed Quality Analyzer Module
 * Deep analysis of product data quality for AI agent visibility
 */

export {
    analyzeProductFeed,
    analyzeProductFeedFromHtml,
    analyzeProduct,
    extractProductsFromHtml,
    validateGtin,
} from './feed-analyzer.js';

export type {
    ProductData,
    ProductOffer,
    ProductAnalysis,
    QualityCheck,
    FeedAnalysisResult,
    FeedAnalysisInput,
    CategoryScores,
    Recommendation,
    FeedSummary,
    GtinValidation,
    IssueSeverity,
    CheckCategory,
} from './types.js';

export {
    QUALITY_CHECKS,
    VALID_AVAILABILITY_VALUES,
    CATEGORY_WEIGHTS,
    GRADE_THRESHOLDS,
} from './types.js';
