import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

// Initialize OpenAI client
const openai = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here'
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

// Knowledge base for the chatbot
const knowledgeBase = {
  products: {
    sunglasses: 'We offer a wide range of sunglasses from premium brands like Ray-Ban, Fastrack, and more. Our sunglasses come with UV protection and various styles.',
    eyeglasses: 'Our eyeglasses collection includes frames for all face shapes. We offer both prescription and non-prescription options.',
    contactLenses: 'We have daily, weekly, and monthly contact lenses from top brands. All lenses are FDA approved.',
    computerGlasses: 'Our computer glasses feature blue light filtering technology to protect your eyes from digital strain.'
  },
  policies: {
    returns: 'We offer a 7-day return policy for all products. Items must be unused and in original packaging.',
    shipping: 'Free shipping on orders above ₹999. Standard delivery takes 3-5 business days.',
    warranty: 'All products come with manufacturer warranty. Extended warranty available for purchase.',
    payment: 'We accept all major credit/debit cards, UPI, net banking, and wallets. 100% secure payment gateway.'
  },
  services: {
    virtualTryOn: 'Try on glasses virtually using our AR technology. Access it from any product page.',
    prescription: 'Upload your prescription during checkout or visit our partner opticians.',
    eyeTest: 'Book a free eye test at our partner stores across India.'
  },
  faq: {
    orderTracking: 'You can track your order from the "My Orders" section in your account.',
    sizeGuide: 'Check the size guide on each product page. Frame dimensions are provided in mm.',
    authenticity: 'All products are 100% genuine and sourced directly from brands.',
    customerSupport: 'Our customer support is available 24/7 via chat, email, or phone.'
  }
};

/**
 * Get intelligent response from OpenAI or fallback to knowledge base
 */
export const getChatbotResponse = async (userMessage, userContext = {}) => {
  try {
    // If OpenAI is not configured, use knowledge base
    if (!openai) {
      return getKnowledgeBaseResponse(userMessage);
    }

    // Prepare context for OpenAI
    const systemPrompt = `You are OptiKart's AI shopping assistant. You help customers with:
    - Product recommendations based on face shape, style preferences, and budget
    - Order tracking and status updates
    - Return and exchange policies
    - Product information and comparisons
    - Prescription and lens guidance
    - Store locations and services
    
    Be friendly, professional, and helpful. Keep responses concise but informative.
    If you don't know something, suggest contacting customer support.
    
    Current user context: ${JSON.stringify(userContext)}`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      max_tokens: parseInt(process.env.CHATBOT_MAX_TOKENS) || 500,
      temperature: parseFloat(process.env.CHATBOT_TEMPERATURE) || 0.7,
    });

    return {
      success: true,
      message: completion.choices[0].message.content,
      source: 'openai'
    };

  } catch (error) {
    console.error('OpenAI API error:', error);
    // Fallback to knowledge base
    return getKnowledgeBaseResponse(userMessage);
  }
};

/**
 * Get response from knowledge base (fallback)
 */
const getKnowledgeBaseResponse = (message) => {
  const lowerMessage = message.toLowerCase();
  
  // Check for product-related queries
  if (lowerMessage.includes('sunglass')) {
    return { success: true, message: knowledgeBase.products.sunglasses, source: 'knowledge-base' };
  }
  if (lowerMessage.includes('eyeglass') || lowerMessage.includes('glass')) {
    return { success: true, message: knowledgeBase.products.eyeglasses, source: 'knowledge-base' };
  }
  if (lowerMessage.includes('contact') || lowerMessage.includes('lens')) {
    return { success: true, message: knowledgeBase.products.contactLenses, source: 'knowledge-base' };
  }
  if (lowerMessage.includes('computer') || lowerMessage.includes('blue light')) {
    return { success: true, message: knowledgeBase.products.computerGlasses, source: 'knowledge-base' };
  }
  
  // Check for policy-related queries
  if (lowerMessage.includes('return') || lowerMessage.includes('refund')) {
    return { success: true, message: knowledgeBase.policies.returns, source: 'knowledge-base' };
  }
  if (lowerMessage.includes('shipping') || lowerMessage.includes('delivery')) {
    return { success: true, message: knowledgeBase.policies.shipping, source: 'knowledge-base' };
  }
  if (lowerMessage.includes('warranty') || lowerMessage.includes('guarantee')) {
    return { success: true, message: knowledgeBase.policies.warranty, source: 'knowledge-base' };
  }
  if (lowerMessage.includes('payment') || lowerMessage.includes('pay')) {
    return { success: true, message: knowledgeBase.policies.payment, source: 'knowledge-base' };
  }
  
  // Check for service-related queries
  if (lowerMessage.includes('try on') || lowerMessage.includes('virtual')) {
    return { success: true, message: knowledgeBase.services.virtualTryOn, source: 'knowledge-base' };
  }
  if (lowerMessage.includes('prescription')) {
    return { success: true, message: knowledgeBase.services.prescription, source: 'knowledge-base' };
  }
  if (lowerMessage.includes('eye test') || lowerMessage.includes('eye check')) {
    return { success: true, message: knowledgeBase.services.eyeTest, source: 'knowledge-base' };
  }
  
  // Check for FAQ
  if (lowerMessage.includes('track') || lowerMessage.includes('order status')) {
    return { success: true, message: knowledgeBase.faq.orderTracking, source: 'knowledge-base' };
  }
  if (lowerMessage.includes('size') || lowerMessage.includes('fit')) {
    return { success: true, message: knowledgeBase.faq.sizeGuide, source: 'knowledge-base' };
  }
  if (lowerMessage.includes('genuine') || lowerMessage.includes('original') || lowerMessage.includes('authentic')) {
    return { success: true, message: knowledgeBase.faq.authenticity, source: 'knowledge-base' };
  }
  if (lowerMessage.includes('support') || lowerMessage.includes('help') || lowerMessage.includes('contact')) {
    return { success: true, message: knowledgeBase.faq.customerSupport, source: 'knowledge-base' };
  }
  
  // Default response
  return {
    success: true,
    message: "I'd be happy to help! You can ask me about our products, policies, services, or track your order. For specific issues, our customer support team is available 24/7.",
    source: 'knowledge-base'
  };
};

/**
 * Update knowledge base with new information
 */
export const updateKnowledgeBase = (category, key, value) => {
  if (knowledgeBase[category]) {
    knowledgeBase[category][key] = value;
    return true;
  }
  return false;
};

/**
 * Get current knowledge base
 */
export const getKnowledgeBase = () => {
  return knowledgeBase;
};

export default {
  getChatbotResponse,
  updateKnowledgeBase,
  getKnowledgeBase
};
