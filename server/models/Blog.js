import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const blogSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    content: { type: String, required: [true, 'Content is required'] },
    excerpt: { type: String, default: '' },
    coverImage: { type: String, default: '' },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: String, default: 'general' },
    tags: [String],
    isPublished: { type: Boolean, default: false },
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    comments: [commentSchema],
  },
  {
    timestamps: true,
  }
);

// owner rule 2026-11: demo rows (fixtures) vs live rows (real signups/uploads). Bulk tools may
// only touch demo; live data disappears only through the per-row admin delete paths.
// dataOrigin: 'demo' rows come only from fixtures; 'live' rows are real business. Bulk purge tooling may
// only remove demo data - a live row leaves the database only through services/accountDelete.js (admin click +
// open-business guard). Owner rule 2026-11: real data is never collateral damage.
blogSchema.add({ dataOrigin: { type: String, enum: ['demo', 'live'], default: 'live', index: true } });
const Blog = mongoose.model('Blog', blogSchema);
export default Blog;
