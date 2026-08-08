import mongoose from 'mongoose';

const bannerSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  // Device-specific images
  images: {
    desktop: {
      url: { type: String, required: true },
      aspectRatio: { type: String, default: '1:1' } // Square for desktop
    },
    tablet: {
      url: { type: String, required: true },
      aspectRatio: { type: String, default: '16:9' } // Horizontal banner for tablet
    },
    mobile: {
      url: { type: String, required: true },
      aspectRatio: { type: String, default: '9:16' } // Vertical banner for mobile
    }
  },
  linkUrl: {
    type: String,
    required: true,
    trim: true
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

const Banner = mongoose.model('Banner', bannerSchema);

export default Banner;
