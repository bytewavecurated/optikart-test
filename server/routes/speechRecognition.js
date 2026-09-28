import express from 'express';
import multer from 'multer';
import { processAudioSearch, buildSearchFilters } from '../services/speechRecognition.js';

const router = express.Router();

// Configure multer for audio file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit for audio
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'audio/webm',
      'audio/wav',
      'audio/mp3',
      'audio/mpeg',
      'audio/ogg',
      'audio/webm;codecs=opus'
    ];
    if (allowedTypes.includes(file.mimetype) || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only audio files are allowed.'));
    }
  }
});

/**
 * POST /api/speech/search
 * Process audio search query
 */
router.post('/search', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No audio file uploaded'
      });
    }

    const language = req.body.language || 'en-US';

    // Process audio search
    const result = await processAudioSearch(req.file.buffer, language);

    // Build search filters from keywords
    const filters = buildSearchFilters(result.keywords);

    res.json({
      success: true,
      data: {
        transcript: result.originalTranscript,
        searchQuery: result.searchQuery,
        keywords: result.keywords,
        filters: filters,
        confidence: result.confidence,
        language: result.language
      }
    });
  } catch (error) {
    console.error('Speech search error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to process audio search',
      error: error.message
    });
  }
});

/**
 * POST /api/speech/transcribe
 * Transcribe audio to text without search processing
 */
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No audio file uploaded'
      });
    }

    const language = req.body.language || 'en-US';

    // Import speechToText function
    const { speechToText } = await import('../services/speechRecognition.js');
    const result = await speechToText(req.file.buffer, language);

    res.json({
      success: true,
      data: {
        transcript: result.transcript,
        confidence: result.confidence,
        language: result.language,
        source: result.source
      }
    });
  } catch (error) {
    console.error('Speech transcribe error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to transcribe audio',
      error: error.message
    });
  }
});

/**
 * GET /api/speech/languages
 * Get list of supported languages for speech recognition
 */
router.get('/languages', (req, res) => {
  try {
    const languages = [
      { code: 'en-US', name: 'English (US)' },
      { code: 'en-GB', name: 'English (UK)' },
      { code: 'en-IN', name: 'English (India)' },
      { code: 'hi-IN', name: 'Hindi (India)' },
      { code: 'es-ES', name: 'Spanish (Spain)' },
      { code: 'fr-FR', name: 'French (France)' },
      { code: 'de-DE', name: 'German (Germany)' },
      { code: 'ja-JP', name: 'Japanese (Japan)' },
      { code: 'zh-CN', name: 'Chinese (Mandarin)' }
    ];

    res.json({
      success: true,
      data: languages
    });
  } catch (error) {
    console.error('Get languages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get languages',
      error: error.message
    });
  }
});

export default router;
