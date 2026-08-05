import express from 'express';
import HelpArticle from '../models/HelpArticle.js';
import { verifyToken, verifyAdmin } from '../middleware/auth.js';
import { sendOTP } from '../services/email.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { category, role, faq, page = 1, limit = 20 } = req.query;

    const query = { isActive: true };
    if (category) query.category = category;
    if (role && role !== 'both') {
      query.$or = [{ forRole: role }, { forRole: 'both' }];
    }
    if (faq !== undefined) query.faq = faq === 'true';

    const articles = await HelpArticle.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await HelpArticle.countDocuments(query);

    res.json({
      success: true,
      articles,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get help articles error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const article = await HelpArticle.findById(req.params.id);

    if (!article) {
      return res.status(404).json({ success: false, message: 'Article not found.' });
    }

    res.json({ success: true, article });
  } catch (error) {
    console.error('Get help article error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.post('/', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { title, content, category, forRole, faq, question, answer } = req.body;

    if (!title || !category) {
      return res.status(400).json({ success: false, message: 'Title and category are required.' });
    }

    const article = new HelpArticle({
      title,
      content: content || '',
      category,
      forRole: forRole || 'both',
      faq: faq || false,
      question: question || '',
      answer: answer || ''
    });

    await article.save();

    res.status(201).json({
      success: true,
      message: 'Help article created successfully.',
      article
    });
  } catch (error) {
    console.error('Create help article error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.put('/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { title, content, category, forRole, faq, question, answer, isActive } = req.body;

    const article = await HelpArticle.findById(req.params.id);
    if (!article) {
      return res.status(404).json({ success: false, message: 'Article not found.' });
    }

    if (title) article.title = title;
    if (content) article.content = content;
    if (category) article.category = category;
    if (forRole) article.forRole = forRole;
    if (faq !== undefined) article.faq = faq;
    if (question) article.question = question;
    if (answer) article.answer = answer;
    if (isActive !== undefined) article.isActive = isActive;

    await article.save();

    res.json({
      success: true,
      message: 'Help article updated successfully.',
      article
    });
  } catch (error) {
    console.error('Update help article error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.post('/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: 'Name, email, and message are required.' });
    }

    await sendOTP(
      process.env.ADMIN_EMAIL,
      `Contact Form: ${subject || 'General Inquiry'} - From: ${name} (${email}) - Message: ${message}`,
      'system'
    );

    res.json({
      success: true,
      message: 'Your message has been sent. We will get back to you soon.'
    });
  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

export default router;
