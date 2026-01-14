/**
 * Vercel Serverless Function: Generate Schema.org Snippets
 * POST /api/generate-schema
 *
 * Generates ready-to-use JSON-LD snippets for:
 * - MerchantReturnPolicy
 * - OfferShippingDetails
 * - Complete Product schema
 */

// Default templates for common scenarios
const RETURN_POLICY_TEMPLATES = {
  '30-day-free': {
    '@context': 'https://schema.org',
    '@type': 'MerchantReturnPolicy',
    '@id': '#return-policy',
    name: '30-Day Free Returns',
    applicableCountry: 'US',
    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
    merchantReturnDays: 30,
    returnMethod: 'https://schema.org/ReturnByMail',
    returnFees: 'https://schema.org/FreeReturn',
    returnShippingFeesAmount: {
      '@type': 'MonetaryAmount',
      value: 0,
      currency: 'USD',
    },
  },
  '14-day-free': {
    '@context': 'https://schema.org',
    '@type': 'MerchantReturnPolicy',
    '@id': '#return-policy',
    name: '14-Day Free Returns',
    applicableCountry: 'US',
    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
    merchantReturnDays: 14,
    returnMethod: 'https://schema.org/ReturnByMail',
    returnFees: 'https://schema.org/FreeReturn',
  },
  '30-day-paid': {
    '@context': 'https://schema.org',
    '@type': 'MerchantReturnPolicy',
    '@id': '#return-policy',
    name: '30-Day Returns',
    applicableCountry: 'US',
    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
    merchantReturnDays: 30,
    returnMethod: 'https://schema.org/ReturnByMail',
    returnFees: 'https://schema.org/ReturnShippingFees',
  },
  'no-returns': {
    '@context': 'https://schema.org',
    '@type': 'MerchantReturnPolicy',
    '@id': '#return-policy',
    name: 'Final Sale - No Returns',
    applicableCountry: 'US',
    returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted',
  },
};

const SHIPPING_TEMPLATES = {
  'us-standard': {
    '@context': 'https://schema.org',
    '@type': 'OfferShippingDetails',
    '@id': '#shipping-us-standard',
    shippingRate: {
      '@type': 'MonetaryAmount',
      value: 5.99,
      currency: 'USD',
    },
    shippingDestination: {
      '@type': 'DefinedRegion',
      addressCountry: 'US',
    },
    deliveryTime: {
      '@type': 'ShippingDeliveryTime',
      handlingTime: {
        '@type': 'QuantitativeValue',
        minValue: 1,
        maxValue: 2,
        unitCode: 'd',
      },
      transitTime: {
        '@type': 'QuantitativeValue',
        minValue: 3,
        maxValue: 7,
        unitCode: 'd',
      },
    },
  },
  'us-free': {
    '@context': 'https://schema.org',
    '@type': 'OfferShippingDetails',
    '@id': '#shipping-us-free',
    shippingRate: {
      '@type': 'MonetaryAmount',
      value: 0,
      currency: 'USD',
    },
    shippingDestination: {
      '@type': 'DefinedRegion',
      addressCountry: 'US',
    },
    deliveryTime: {
      '@type': 'ShippingDeliveryTime',
      handlingTime: {
        '@type': 'QuantitativeValue',
        minValue: 1,
        maxValue: 2,
        unitCode: 'd',
      },
      transitTime: {
        '@type': 'QuantitativeValue',
        minValue: 5,
        maxValue: 10,
        unitCode: 'd',
      },
    },
  },
  'us-express': {
    '@context': 'https://schema.org',
    '@type': 'OfferShippingDetails',
    '@id': '#shipping-us-express',
    shippingRate: {
      '@type': 'MonetaryAmount',
      value: 14.99,
      currency: 'USD',
    },
    shippingDestination: {
      '@type': 'DefinedRegion',
      addressCountry: 'US',
    },
    deliveryTime: {
      '@type': 'ShippingDeliveryTime',
      handlingTime: {
        '@type': 'QuantitativeValue',
        minValue: 0,
        maxValue: 1,
        unitCode: 'd',
      },
      transitTime: {
        '@type': 'QuantitativeValue',
        minValue: 1,
        maxValue: 2,
        unitCode: 'd',
      },
    },
  },
  'international': {
    '@context': 'https://schema.org',
    '@type': 'OfferShippingDetails',
    '@id': '#shipping-international',
    shippingRate: {
      '@type': 'MonetaryAmount',
      value: 19.99,
      currency: 'USD',
    },
    shippingDestination: {
      '@type': 'DefinedRegion',
      addressCountry: ['CA', 'GB', 'AU', 'DE', 'FR'],
    },
    deliveryTime: {
      '@type': 'ShippingDeliveryTime',
      handlingTime: {
        '@type': 'QuantitativeValue',
        minValue: 1,
        maxValue: 3,
        unitCode: 'd',
      },
      transitTime: {
        '@type': 'QuantitativeValue',
        minValue: 7,
        maxValue: 21,
        unitCode: 'd',
      },
    },
  },
};

function generateCustomReturnPolicy(options) {
  const {
    country = 'US',
    returnDays = 30,
    freeReturns = true,
    returnFee = 0,
    currency = 'USD',
    policyName = `${returnDays}-Day Returns`,
    noReturns = false,
  } = options;

  if (noReturns) {
    return {
      '@context': 'https://schema.org',
      '@type': 'MerchantReturnPolicy',
      '@id': '#return-policy',
      name: policyName || 'Final Sale - No Returns',
      applicableCountry: country,
      returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted',
    };
  }

  const policy = {
    '@context': 'https://schema.org',
    '@type': 'MerchantReturnPolicy',
    '@id': '#return-policy',
    name: policyName,
    applicableCountry: country,
    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
    merchantReturnDays: returnDays,
    returnMethod: 'https://schema.org/ReturnByMail',
  };

  if (freeReturns) {
    policy.returnFees = 'https://schema.org/FreeReturn';
  } else {
    policy.returnFees = 'https://schema.org/ReturnShippingFees';
    if (returnFee > 0) {
      policy.returnShippingFeesAmount = {
        '@type': 'MonetaryAmount',
        value: returnFee,
        currency: currency,
      };
    }
  }

  return policy;
}

function generateCustomShipping(options) {
  const {
    country = 'US',
    rate = 5.99,
    currency = 'USD',
    freeShipping = false,
    handlingMin = 1,
    handlingMax = 2,
    transitMin = 3,
    transitMax = 7,
  } = options;

  return {
    '@context': 'https://schema.org',
    '@type': 'OfferShippingDetails',
    '@id': `#shipping-${country.toLowerCase()}`,
    shippingRate: {
      '@type': 'MonetaryAmount',
      value: freeShipping ? 0 : rate,
      currency: currency,
    },
    shippingDestination: {
      '@type': 'DefinedRegion',
      addressCountry: country,
    },
    deliveryTime: {
      '@type': 'ShippingDeliveryTime',
      handlingTime: {
        '@type': 'QuantitativeValue',
        minValue: handlingMin,
        maxValue: handlingMax,
        unitCode: 'd',
      },
      transitTime: {
        '@type': 'QuantitativeValue',
        minValue: transitMin,
        maxValue: transitMax,
        unitCode: 'd',
      },
    },
  };
}

function generateProductSchema(options) {
  const {
    name,
    description,
    image,
    sku,
    brand,
    price,
    currency = 'USD',
    availability = 'InStock',
    condition = 'NewCondition',
    includeReturnPolicy = true,
    includeShipping = true,
    returnPolicyRef = '#return-policy',
    shippingRef = '#shipping-us-standard',
  } = options;

  const product = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: name || 'Product Name',
    description: description || 'Product description goes here. Aim for 150-300 characters to help AI agents understand your product.',
  };

  if (image) {
    product.image = image;
  }

  if (sku) {
    product.sku = sku;
  }

  if (brand) {
    product.brand = {
      '@type': 'Brand',
      name: brand,
    };
  }

  product.offers = {
    '@type': 'Offer',
    price: price || 29.99,
    priceCurrency: currency,
    availability: `https://schema.org/${availability}`,
    itemCondition: `https://schema.org/${condition}`,
  };

  if (includeReturnPolicy) {
    product.offers.hasMerchantReturnPolicy = { '@id': returnPolicyRef };
  }

  if (includeShipping) {
    product.offers.shippingDetails = { '@id': shippingRef };
  }

  return product;
}

function generateCompleteSchema(options) {
  const {
    returnPolicy = '30-day-free',
    shipping = 'us-standard',
    customReturn,
    customShipping,
    product,
  } = options;

  const schemas = [];

  // Add return policy
  if (customReturn) {
    schemas.push(generateCustomReturnPolicy(customReturn));
  } else if (RETURN_POLICY_TEMPLATES[returnPolicy]) {
    schemas.push(RETURN_POLICY_TEMPLATES[returnPolicy]);
  }

  // Add shipping
  if (customShipping) {
    schemas.push(generateCustomShipping(customShipping));
  } else if (SHIPPING_TEMPLATES[shipping]) {
    schemas.push(SHIPPING_TEMPLATES[shipping]);
  }

  // Add product if provided
  if (product) {
    schemas.push(generateProductSchema(product));
  }

  return schemas;
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: Return available templates
  if (req.method === 'GET') {
    return res.status(200).json({
      templates: {
        returnPolicy: Object.keys(RETURN_POLICY_TEMPLATES),
        shipping: Object.keys(SHIPPING_TEMPLATES),
      },
      description: 'Use POST to generate custom Schema.org snippets',
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    type, // 'return-policy', 'shipping', 'product', 'complete'
    template, // template name for quick generation
    options = {}, // custom options
  } = req.body;

  try {
    let schema;
    let embedCode;

    switch (type) {
      case 'return-policy':
        if (template && RETURN_POLICY_TEMPLATES[template]) {
          schema = RETURN_POLICY_TEMPLATES[template];
        } else {
          schema = generateCustomReturnPolicy(options);
        }
        break;

      case 'shipping':
        if (template && SHIPPING_TEMPLATES[template]) {
          schema = SHIPPING_TEMPLATES[template];
        } else {
          schema = generateCustomShipping(options);
        }
        break;

      case 'product':
        schema = generateProductSchema(options);
        break;

      case 'complete':
        schema = generateCompleteSchema(options);
        break;

      default:
        return res.status(400).json({
          error: 'Invalid type. Use: return-policy, shipping, product, or complete',
          availableTemplates: {
            returnPolicy: Object.keys(RETURN_POLICY_TEMPLATES),
            shipping: Object.keys(SHIPPING_TEMPLATES),
          },
        });
    }

    // Generate embed code
    const schemaJson = JSON.stringify(schema, null, 2);
    embedCode = `<script type="application/ld+json">
${schemaJson}
</script>`;

    return res.status(200).json({
      success: true,
      type,
      schema,
      embedCode,
      instructions: [
        'Copy the embedCode and paste it into your HTML <head> section',
        'For products, add the schema to each product page',
        'Use the @id references to link return policy and shipping to products',
        'Validate at https://validator.schema.org/',
      ],
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to generate schema',
      message: error.message,
    });
  }
}
