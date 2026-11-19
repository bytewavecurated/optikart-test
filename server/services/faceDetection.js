import '../config/loadEnv.js'; // env loading belongs to one place, and it honours ENV_FILE
import axios from 'axios';

/*
 * v3 (aws-sdk v2 reached end of support: frozen at one advisory, printing an
 * end-of-support warning on every boot even on boxes with no AWS configured,
 * because v2 constructed the client at module-load time). v3 changes two
 * things that matter, not just the package name:
 *  - the SDK is imported LAZILY, so a server with no Rekognition credentials
 *    never even loads it (and never prints anything about it);
 *  - the credential check is one branch (the old file tested
 *    AWS_ACCESS_KEY_ID twice with the same sentinel - a dead second arm).
 * `AWS_ENDPOINT` points the client at any SigV4-compatible endpoint - the same
 * hole every v3 client leaves open for mocks and local stacks, and the
 * face-shape mock suite drives a fake Rekognition through it with REAL
 * response shapes captured from AWS's documented output.
 */
const credentialsConfigured = () =>
  Boolean(process.env.AWS_ACCESS_KEY_ID) && process.env.AWS_ACCESS_KEY_ID !== 'your_aws_access_key_here';

let rekognitionPromise = null;
const rekognition = async () => {
  if (!credentialsConfigured()) return null;
  if (!rekognitionPromise) {
    rekognitionPromise = import('@aws-sdk/client-rekognition').then(
      ({ RekognitionClient }) =>
        new RekognitionClient({
          region: process.env.AWS_REGION || 'us-east-1',
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          },
          ...(process.env.AWS_ENDPOINT ? { endpoint: process.env.AWS_ENDPOINT } : {}),
        })
    );
  }
  return rekognitionPromise;
};

/**
 * Detect face shape from image using configured service
 */
export const detectFaceShape = async (imageBuffer) => {
  const service = process.env.FACE_DETECTION_SERVICE || 'aws';

  try {
    switch (service) {
      case 'aws':
        return await detectWithAWS(imageBuffer);
      case 'google':
        return await detectWithGoogle(imageBuffer);
      case 'azure':
        return await detectWithAzure(imageBuffer);
      default:
        return await detectWithAWS(imageBuffer);
    }
  } catch (error) {
    /*
     * The simulation is for the PROVIDER BEING ABSENT - a box that has no
     * Rekognition configured, which is what its own code branch already
     * checked. Once a caller DID configure a provider and the provider then
     * fails (bad keys, region typo, endpoint down), returning a simulated
     * result labelled it a detection anyway: the guidance page told real
     * customers their face was 'oblong' because an AWS call threw. Now:
     * configured-and-failing surfaces as a refusal WITH the reason, the way
     * every other integration in this app reports its own absence or failure;
     * not-configured still simulates, loudly naming itself as simulation.
     */
    const byProvider =
      service === 'aws'
        ? credentialsConfigured()
        : service === 'google'
          ? Boolean(
              process.env.GOOGLE_VISION_API_KEY &&
              process.env.GOOGLE_VISION_API_KEY !== 'your_google_vision_api_key_here'
            )
          : service === 'azure'
            ? Boolean(process.env.AZURE_FACE_API_KEY && process.env.AZURE_FACE_ENDPOINT)
            : false;
    if (byProvider) {
      console.error(`Face detection via ${service} failed after configuration:`, error.message);
      throw new Error(
        `Face analysis is temporarily unavailable (${service} refused the request). Try again shortly or use the guided questions.`
      );
    }
    console.warn(`Face detection via ${service} not configured; using guidance simulation for this request.`);
    return simulateFaceDetection();
  }
};

/**
 * Detect face shape using AWS Rekognition
 */
const detectWithAWS = async (imageBuffer) => {
  const client = await rekognition();
  if (!client) {
    console.warn('AWS Rekognition not configured, using simulation');
    return simulateFaceDetection();
  }

  const { DetectFacesCommand } = await import('@aws-sdk/client-rekognition');
  const result = await client.send(
    new DetectFacesCommand({
      Image: { Bytes: imageBuffer },
      Attributes: ['ALL'],
    })
  );

  if (!result.FaceDetails || result.FaceDetails.length === 0) {
    throw new Error('No face detected in the image');
  }

  /*
   * Casing normalizer, and THE reason it exists: aws-sdk v2 lower-camel-cased
   * every response member (Landmarks: [{type,x,y}]), while the v3 client hands
   * back the documented wire shape ({Type,X,Y}). The geometry function below was
   * written against v2's keys; without this map, rightEye is undefined on the
   * first real photo and the port would fail LOUDLY in production and silently
   * in review. Accepting both shapes keeps the old sim fixtures honest too.
   */
  const raw = result.FaceDetails[0];
  const face = {
    ...raw,
    Landmarks: (raw.Landmarks || []).map((l) => ({
      type: String(l.type ?? l.Type ?? ''),
      x: Number(l.x ?? l.X),
      y: Number(l.y ?? l.Y),
    })),
  };

  // Analyze face geometry to determine shape
  const faceShape = analyzeFaceGeometry(face);

  return {
    success: true,
    faceShape: faceShape,
    confidence: face.Confidence,
    landmarks: face.Landmarks,
    boundingBox: face.BoundingBox,
    source: 'aws-rekognition',
  };
};

/**
 * Detect face shape using Google Cloud Vision
 */
const detectWithGoogle = async (imageBuffer) => {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;

  if (!apiKey || apiKey === 'your_google_vision_api_key_here') {
    console.warn('Google Vision API not configured, using simulation');
    return simulateFaceDetection();
  }

  const base64Image = imageBuffer.toString('base64');

  const response = await axios.post(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
    requests: [
      {
        image: { content: base64Image },
        features: [{ type: 'FACE_DETECTION', maxResults: 1 }],
      },
    ],
  });

  const faces = response.data.responses[0].faceAnnotations;

  if (!faces || faces.length === 0) {
    throw new Error('No face detected in the image');
  }

  const face = faces[0];
  const faceShape = analyzeGoogleFaceData(face);

  return {
    success: true,
    faceShape: faceShape,
    confidence: face.detectionConfidence * 100,
    landmarks: face.landmarks,
    boundingBox: face.boundingPoly,
    source: 'google-vision',
  };
};

/**
 * Detect face shape using Azure Face API
 */
const detectWithAzure = async (imageBuffer) => {
  const apiKey = process.env.AZURE_FACE_API_KEY;
  const endpoint = process.env.AZURE_FACE_ENDPOINT;

  if (!apiKey || apiKey === 'your_azure_face_api_key_here' || !endpoint) {
    console.warn('Azure Face API not configured, using simulation');
    return simulateFaceDetection();
  }

  const response = await axios.post(`${endpoint}/face/v1.0/detect`, imageBuffer, {
    headers: {
      'Ocp-Apim-Subscription-Key': apiKey,
      'Content-Type': 'application/octet-stream',
    },
    params: {
      returnFaceLandmarks: 'true',
      returnFaceAttributes: 'headPose,faceRectangle',
    },
  });

  if (!response.data || response.data.length === 0) {
    throw new Error('No face detected in the image');
  }

  const face = response.data[0];
  const faceShape = analyzeAzureFaceData(face);

  return {
    success: true,
    faceShape: faceShape,
    confidence: 95, // Azure doesn't provide confidence score
    landmarks: face.faceLandmarks,
    boundingBox: face.faceRectangle,
    source: 'azure-face',
  };
};

/**
 * Analyze AWS Rekognition face data to determine face shape
 */
const analyzeFaceGeometry = (face) => {
  const landmarks = face.Landmarks;
  const box = face.BoundingBox;

  // Get key landmarks
  const leftEye = landmarks.find((l) => l.type === 'eyeLeft');
  const rightEye = landmarks.find((l) => l.type === 'eyeRight');
  const nose = landmarks.find((l) => l.type === 'nose');
  const mouthLeft = landmarks.find((l) => l.type === 'mouthLeft');
  const mouthRight = landmarks.find((l) => l.type === 'mouthRight');
  const chin = landmarks.find((l) => l.type === 'chinBottom');

  // Calculate ratios
  const faceWidth = Math.abs(rightEye.x - leftEye.x) * 2.5;
  const faceHeight = Math.abs(chin.y - Math.min(leftEye.y, rightEye.y));
  const jawWidth = Math.abs(mouthRight.x - mouthLeft.x) * 1.5;
  const foreheadWidth = faceWidth * 0.9;

  const widthToHeightRatio = faceWidth / faceHeight;
  const jawToForeheadRatio = jawWidth / foreheadWidth;

  // Determine face shape based on ratios
  let faceShape = 'oval';

  if (widthToHeightRatio > 0.85 && jawToForeheadRatio > 0.9) {
    faceShape = 'round';
  } else if (widthToHeightRatio < 0.75 && jawToForeheadRatio < 0.8) {
    faceShape = 'oblong';
  } else if (jawToForeheadRatio > 1.0 && widthToHeightRatio > 0.8) {
    faceShape = 'square';
  } else if (jawToForeheadRatio < 0.7 && widthToHeightRatio > 0.75) {
    faceShape = 'heart';
  } else if (widthToHeightRatio >= 0.75 && widthToHeightRatio <= 0.85) {
    faceShape = 'oval';
  }

  return faceShape;
};

/**
 * Analyze Google Vision face data
 */
const analyzeGoogleFaceData = (face) => {
  // Similar logic to AWS but adapted for Google's data structure
  const landmarks = face.landmarks;

  // Extract key points
  const leftEye = landmarks.find((l) => l.type === 'LEFT_EYE');
  const rightEye = landmarks.find((l) => l.type === 'RIGHT_EYE');
  const noseTip = landmarks.find((l) => l.type === 'NOSE_TIP');
  const chin = landmarks.find((l) => l.type === 'CHIN_GNATHION');

  // Calculate ratios (simplified)
  const faceWidth = Math.abs(rightEye.position.x - leftEye.position.x) * 2.5;
  const faceHeight = Math.abs(chin.position.y - Math.min(leftEye.position.y, rightEye.position.y));

  const ratio = faceWidth / faceHeight;

  if (ratio > 0.85) return 'round';
  if (ratio < 0.75) return 'oblong';
  if (ratio >= 0.75 && ratio <= 0.85) return 'oval';

  return 'oval';
};

/**
 * Analyze Azure Face API data
 */
const analyzeAzureFaceData = (face) => {
  // Similar logic adapted for Azure's data structure
  const rect = face.faceRectangle;
  const pose = face.faceAttributes.headPose;

  // Use head pose and rectangle proportions
  const ratio = rect.width / rect.height;

  if (ratio > 0.85) return 'round';
  if (ratio < 0.75) return 'oblong';
  if (ratio >= 0.75 && ratio <= 0.85) return 'oval';

  return 'oval';
};

/**
 * Simulate face detection (fallback when no API is configured)
 */
const simulateFaceDetection = () => {
  const shapes = ['oval', 'round', 'square', 'heart', 'oblong'];
  const randomShape = shapes[Math.floor(Math.random() * shapes.length)];

  return {
    success: true,
    faceShape: randomShape,
    confidence: 85 + Math.random() * 15, // 85-100%
    landmarks: null,
    boundingBox: null,
    source: 'simulation',
    message: 'Face detection simulated. Configure API keys for real detection.',
  };
};

/**
 * Get frame recommendations based on face shape
 */
export const getFrameRecommendations = (faceShape) => {
  const recommendations = {
    oval: {
      description: 'You have an oval face shape - most frame styles suit you!',
      recommended: ['rectangle', 'square', 'cat-eye', 'aviator'],
      avoid: ['oversized'],
    },
    round: {
      description: 'You have a round face shape - angular frames will complement your features.',
      recommended: ['rectangle', 'square', 'cat-eye', 'geometric'],
      avoid: ['round', 'oval'],
    },
    square: {
      description: 'You have a square face shape - round or oval frames will soften your angles.',
      recommended: ['round', 'oval', 'aviator', 'cat-eye'],
      avoid: ['square', 'rectangle'],
    },
    heart: {
      description: 'You have a heart-shaped face - frames that are wider at the bottom will balance your features.',
      recommended: ['aviator', 'cat-eye', 'round', 'oval'],
      avoid: ['square'],
    },
    oblong: {
      description: 'You have an oblong face shape - taller frames will complement your face length.',
      recommended: ['square', 'rectangle', 'round', 'aviator'],
      avoid: ['small', 'narrow'],
    },
  };

  return recommendations[faceShape] || recommendations.oval;
};

export default {
  detectFaceShape,
  getFrameRecommendations,
};
