import axios from 'axios';
import AWS from 'aws-sdk';
import dotenv from 'dotenv';

dotenv.config();

// Initialize AWS Transcribe if credentials are available
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_ACCESS_KEY_ID !== 'your_aws_access_key_here') {
  AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'us-east-1'
  });
}

/**
 * Convert speech to text using configured service
 */
export const speechToText = async (audioBuffer, language = 'en-US') => {
  const service = process.env.SPEECH_RECOGNITION_SERVICE || 'google';
  
  try {
    switch (service) {
      case 'google':
        return await transcribeWithGoogle(audioBuffer, language);
      case 'aws':
        return await transcribeWithAWS(audioBuffer, language);
      default:
        return await transcribeWithGoogle(audioBuffer, language);
    }
  } catch (error) {
    console.error('Speech recognition error:', error);
    throw new Error('Failed to process audio. Please try again.');
  }
};

/**
 * Transcribe audio using Google Cloud Speech-to-Text
 */
const transcribeWithGoogle = async (audioBuffer, language) => {
  const apiKey = process.env.GOOGLE_SPEECH_API_KEY;
  
  if (!apiKey || apiKey === 'your_google_speech_api_key_here') {
    throw new Error('Google Speech API not configured');
  }

  const base64Audio = audioBuffer.toString('base64');
  
  const response = await axios.post(
    `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`,
    {
      config: {
        encoding: 'WEBM_OPUS',
        sampleRateHertz: 48000,
        languageCode: language,
        model: 'default',
        enableAutomaticPunctuation: true
      },
      audio: {
        content: base64Audio
      }
    }
  );

  const results = response.data.results;
  
  if (!results || results.length === 0) {
    throw new Error('No speech detected in audio');
  }

  const transcript = results
    .map(result => result.alternatives[0].transcript)
    .join(' ');

  return {
    success: true,
    transcript: transcript,
    confidence: results[0].alternatives[0].confidence || 0.95,
    language: language,
    source: 'google-speech'
  };
};

/**
 * Transcribe audio using AWS Transcribe
 */
const transcribeWithAWS = async (audioBuffer, language) => {
  if (!process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID === 'your_aws_access_key_here') {
    throw new Error('AWS Transcribe not configured');
  }

  const transcribe = new AWS.TranscribeService();
  
  const params = {
    Audio: {
      Payload: audioBuffer
    },
    Settings: {
      LanguageCode: language === 'en-US' ? 'en-US' : 'en-GB',
      MaxAlternatives: 1,
      ShowAlternatives: false
    }
  };

  const result = await transcribe.startStreamTranscription(params).promise();
  
  const transcript = result.TranscriptResult.Transcripts[0].Transcript;
  const confidence = result.TranscriptResult.Transcripts[0].Confidence;

  return {
    success: true,
    transcript: transcript,
    confidence: confidence || 0.95,
    language: language,
    source: 'aws-transcribe'
  };
};

/**
 * Process audio search query
 */
export const processAudioSearch = async (audioBuffer, language = 'en-US') => {
  try {
    // Convert speech to text
    const result = await speechToText(audioBuffer, language);
    
    // Clean and normalize the transcript
    const searchQuery = result.transcript
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/gi, '');
    
    // Extract keywords for product search
    const keywords = extractKeywords(searchQuery);
    
    return {
      success: true,
      originalTranscript: result.transcript,
      searchQuery: searchQuery,
      keywords: keywords,
      confidence: result.confidence,
      language: language
    };
  } catch (error) {
    console.error('Audio search processing error:', error);
    throw error;
  }
};

/**
 * Extract relevant keywords from search query
 */
const extractKeywords = (query) => {
  const keywords = {
    category: null,
    brand: null,
    color: null,
    style: null,
    price: null,
    gender: null
  };

  // Extract category
  if (query.includes('sunglass') || query.includes('sun glass')) {
    keywords.category = 'sunglasses';
  } else if (query.includes('eyeglass') || query.includes('eye glass') || query.includes('spectacle')) {
    keywords.category = 'eyeglasses';
  } else if (query.includes('contact') || query.includes('lens')) {
    keywords.category = 'contact-lenses';
  } else if (query.includes('computer') || query.includes('blue light')) {
    keywords.category = 'computer-glasses';
  }

  // Extract brand
  const brands = ['ray-ban', 'rayban', 'fastrack', 'lenskart', 'oakley', 'voguen', 'john jacobs'];
  for (const brand of brands) {
    if (query.includes(brand)) {
      keywords.brand = brand;
      break;
    }
  }

  // Extract color
  const colors = ['black', 'brown', 'gold', 'silver', 'blue', 'red', 'green', 'pink', 'purple', 'white'];
  for (const color of colors) {
    if (query.includes(color)) {
      keywords.color = color;
      break;
    }
  }

  // Extract style
  const styles = ['aviator', 'wayfarer', 'round', 'square', 'rectangle', 'cat-eye', 'cat eye', 'oval'];
  for (const style of styles) {
    if (query.includes(style)) {
      keywords.style = style;
      break;
    }
  }

  // Extract price range
  if (query.includes('cheap') || query.includes('budget') || query.includes('affordable')) {
    keywords.price = 'low';
  } else if (query.includes('expensive') || query.includes('premium') || query.includes('luxury')) {
    keywords.price = 'high';
  } else if (query.includes('under') || query.includes('below')) {
    const match = query.match(/under\s+(\d+)/);
    if (match) {
      keywords.price = `under-${match[1]}`;
    }
  }

  // Extract gender
  if (query.includes('men') || query.includes('male') || query.includes('man')) {
    keywords.gender = 'men';
  } else if (query.includes('women') || query.includes('female') || query.includes('woman') || query.includes('ladies')) {
    keywords.gender = 'women';
  } else if (query.includes('kids') || query.includes('children') || query.includes('child')) {
    keywords.gender = 'kids';
  }

  return keywords;
};

/**
 * Build search filters from extracted keywords
 */
export const buildSearchFilters = (keywords) => {
  const filters = {};

  if (keywords.category) {
    filters.category = keywords.category;
  }

  if (keywords.brand) {
    filters.brand = keywords.brand;
  }

  if (keywords.color) {
    filters.frameColor = keywords.color;
  }

  if (keywords.style) {
    filters.frameShape = keywords.style;
  }

  if (keywords.gender) {
    filters.gender = keywords.gender;
  }

  if (keywords.price) {
    if (keywords.price === 'low') {
      filters.maxPrice = 2000;
    } else if (keywords.price === 'high') {
      filters.minPrice = 5000;
    } else if (keywords.price.startsWith('under-')) {
      const amount = parseInt(keywords.price.split('-')[1]);
      filters.maxPrice = amount;
    }
  }

  return filters;
};

export default {
  speechToText,
  processAudioSearch,
  buildSearchFilters
};
