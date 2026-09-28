import express from 'express';
import { getChatbotResponse, updateKnowledgeBase, getKnowledgeBase } from '../services/chatbot.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/chatbot/message
 * Send a message to the chatbot and get a response
 */
router.post('/message', async (req, res) => {
  try {
    const { message, userContext } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    const response = await getChatbotResponse(message, userContext || {});

    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('Chatbot message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process message',
      error: error.message
    });
  }
});

/**
 * GET /api/chatbot/knowledge
 * Get the current knowledge base (admin only)
 */
router.get('/knowledge', verifyToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    const knowledgeBase = getKnowledgeBase();

    res.json({
      success: true,
      data: knowledgeBase
    });
  } catch (error) {
    console.error('Get knowledge base error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get knowledge base',
      error: error.message
    });
  }
});

/**
 * PUT /api/chatbot/knowledge
 * Update the knowledge base (admin only)
 */
router.put('/knowledge', verifyToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    const { category, key, value } = req.body;

    if (!category || !key || !value) {
      return res.status(400).json({
        success: false,
        message: 'Category, key, and value are required'
      });
    }

    const updated = updateKnowledgeBase(category, key, value);

    if (!updated) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category'
      });
    }

    res.json({
      success: true,
      message: 'Knowledge base updated successfully'
    });
  } catch (error) {
    console.error('Update knowledge base error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update knowledge base',
      error: error.message
    });
  }
});

/**
 * POST /api/chatbot/suggestions
 * Get suggested questions for the chatbot
 */
router.post('/suggestions', async (req, res) => {
  try {
    const { context } = req.body;

    const suggestions = [
      'What products do you offer?',
      'How can I track my order?',
      'What is your return policy?',
      'Do you offer virtual try-on?',
      'How do I upload my prescription?',
      'What payment methods do you accept?',
      'Do you have free shipping?',
      'How long does delivery take?'
    ];

    // Filter suggestions based on context if provided
    let filteredSuggestions = suggestions;
    
    if (context && context.page) {
      if (context.page.includes('product')) {
        filteredSuggestions = suggestions.filter(s => 
          s.includes('product') || s.includes('try-on') || s.includes('prescription')
        );
      } else if (context.page.includes('order')) {
        filteredSuggestions = suggestions.filter(s => 
          s.includes('order') || s.includes('delivery') || s.includes('return')
        );
      } else if (context.page.includes('cart')) {
        filteredSuggestions = suggestions.filter(s => 
          s.includes('payment') || s.includes('shipping')
        );
      }
    }

    res.json({
      success: true,
      data: filteredSuggestions
    });
  } catch (error) {
    console.error('Get suggestions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get suggestions',
      error: error.message
    });
  }
});

export default router;
