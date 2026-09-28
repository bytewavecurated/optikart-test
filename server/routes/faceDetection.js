import express from 'express';
import multer from 'multer';
import { detectFaceShape, getFrameRecommendations } from '../services/faceDetection.js';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG and PNG are allowed.'));
    }
  }
});

/**
 * POST /api/face-detection/detect
 * Detect face shape from uploaded image
 */
router.post('/detect', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image uploaded'
      });
    }

    // Detect face shape
    const result = await detectFaceShape(req.file.buffer);

    // Get frame recommendations
    const recommendations = getFrameRecommendations(result.faceShape);

    res.json({
      success: true,
      data: {
        faceShape: result.faceShape,
        confidence: result.confidence,
        description: recommendations.description,
        recommendedFrames: recommendations.recommended,
        framesToAvoid: recommendations.avoid,
        source: result.source,
        message: result.message
      }
    });
  } catch (error) {
    console.error('Face detection error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to detect face shape',
      error: error.message
    });
  }
});

/**
 * GET /api/face-detection/recommendations/:faceShape
 * Get frame recommendations for a specific face shape
 */
router.get('/recommendations/:faceShape', (req, res) => {
  try {
    const { faceShape } = req.params;
    const recommendations = getFrameRecommendations(faceShape);

    if (!recommendations) {
      return res.status(400).json({
        success: false,
        message: 'Invalid face shape'
      });
    }

    res.json({
      success: true,
      data: {
        faceShape,
        ...recommendations
      }
    });
  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get recommendations',
      error: error.message
    });
  }
});

/**
 * GET /api/face-detection/face-shapes
 * Get list of all face shapes and their characteristics
 */
router.get('/face-shapes', (req, res) => {
  try {
    const faceShapes = {
      oval: {
        name: 'Oval',
        description: 'Balanced proportions with slightly narrower forehead and jaw',
        characteristics: [
          'Face length is greater than the width',
          'Forehead is slightly wider than the jaw',
          'Rounded chin'
        ]
      },
      round: {
        name: 'Round',
        description: 'Similar width and length with full cheeks',
        characteristics: [
          'Face width and length are similar',
          'Full, rounded cheeks',
          'Soft, rounded chin'
        ]
      },
      square: {
        name: 'Square',
        description: 'Strong jawline with similar width and length',
        characteristics: [
          'Face width and length are similar',
          'Strong, angular jawline',
          'Broad forehead'
        ]
      },
      heart: {
        name: 'Heart',
        description: 'Wider forehead with narrow chin',
        characteristics: [
          'Wider forehead',
          'High, prominent cheekbones',
          'Narrow, pointed chin'
        ]
      },
      oblong: {
        name: 'Oblong',
        description: 'Long face with similar width throughout',
        characteristics: [
          'Face length is significantly greater than width',
          'Straight cheek lines',
          'Longer chin'
        ]
      }
    };

    res.json({
      success: true,
      data: faceShapes
    });
  } catch (error) {
    console.error('Get face shapes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get face shapes',
      error: error.message
    });
  }
});

export default router;
