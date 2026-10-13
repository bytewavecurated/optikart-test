import mongoose from 'mongoose';

const comparisonListSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    default: 'My Comparison'
  },
  products: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  shareToken: {
    type: String,
    unique: true,
    sparse: true
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

comparisonListSchema.index({ user: 1, createdAt: -1 });
comparisonListSchema.index({ shareToken: 1 });

const ComparisonList = mongoose.model('ComparisonList', comparisonListSchema);

export default ComparisonList;
