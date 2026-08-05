import express from 'express';
import Blog from '../models/Blog.js';
import { verifyToken, verifyAdmin, verifyStaff, verifyStaffPermission } from '../middleware/auth.js';

const router = express.Router();

const generateSlug = (title) => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
};

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, category, tag } = req.query;

    const query = { isPublished: true };
    if (category) query.category = category;
    if (tag) query.tags = { $in: [tag] };

    const blogs = await Blog.find(query)
      .populate('author', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Blog.countDocuments(query);

    res.json({
      success: true,
      blogs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get blogs error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.get('/:slug', async (req, res) => {
  try {
    const blog = await Blog.findOne({ slug: req.params.slug })
      .populate('author', 'name avatar')
      .populate('comments.user', 'name avatar');

    if (!blog) {
      return res.status(404).json({ success: false, message: 'Blog not found.' });
    }

    blog.views += 1;
    await blog.save();

    res.json({ success: true, blog });
  } catch (error) {
    console.error('Get blog error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.post('/', verifyToken, async (req, res) => {
  try {
    const { title, content, excerpt, coverImage, category, tags, isPublished } = req.body;

    if (req.user.role !== 'admin') {
      const hasPermission = req.user.permissions && req.user.permissions.includes('manage_blogs');
      if (!hasPermission) {
        return res.status(403).json({ success: false, message: 'Access denied. Blog management permission required.' });
      }
    }

    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Title and content are required.' });
    }

    let slug = generateSlug(title);
    const existingSlug = await Blog.findOne({ slug });
    if (existingSlug) {
      slug = `${slug}-${Date.now()}`;
    }

    const blog = new Blog({
      title,
      slug,
      content,
      excerpt: excerpt || content.substring(0, 200),
      coverImage: coverImage || '',
      author: req.user._id,
      category: category || 'general',
      tags: tags || [],
      isPublished: isPublished || false
    });

    await blog.save();

    res.status(201).json({
      success: true,
      message: 'Blog created successfully.',
      blog
    });
  } catch (error) {
    console.error('Create blog error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.put('/:id', verifyToken, async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) {
      return res.status(404).json({ success: false, message: 'Blog not found.' });
    }

    if (req.user.role !== 'admin' && blog.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const { title, content, excerpt, coverImage, category, tags, isPublished } = req.body;

    if (title) {
      blog.title = title;
      blog.slug = generateSlug(title);
    }
    if (content) blog.content = content;
    if (excerpt) blog.excerpt = excerpt;
    if (coverImage) blog.coverImage = coverImage;
    if (category) blog.category = category;
    if (tags) blog.tags = tags;
    if (isPublished !== undefined) blog.isPublished = isPublished;

    await blog.save();

    res.json({
      success: true,
      message: 'Blog updated successfully.',
      blog
    });
  } catch (error) {
    console.error('Update blog error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) {
      return res.status(404).json({ success: false, message: 'Blog not found.' });
    }

    if (req.user.role !== 'admin' && blog.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    await Blog.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Blog deleted successfully.'
    });
  } catch (error) {
    console.error('Delete blog error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.post('/:id/comment', verifyToken, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ success: false, message: 'Comment text is required.' });
    }

    const blog = await Blog.findById(req.params.id);
    if (!blog) {
      return res.status(404).json({ success: false, message: 'Blog not found.' });
    }

    blog.comments.push({
      user: req.user._id,
      text,
      createdAt: new Date()
    });

    await blog.save();

    const updatedBlog = await Blog.findById(req.params.id)
      .populate('comments.user', 'name avatar');

    res.json({
      success: true,
      message: 'Comment added.',
      comments: updatedBlog.comments
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.post('/:id/like', verifyToken, async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) {
      return res.status(404).json({ success: false, message: 'Blog not found.' });
    }

    blog.likes += 1;
    await blog.save();

    res.json({
      success: true,
      message: 'Blog liked.',
      likes: blog.likes
    });
  } catch (error) {
    console.error('Like blog error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

export default router;
