import PrescriptionVerification from '../models/PrescriptionVerification.js';
import Prescription from '../models/Prescription.js';

/**
 * Validate prescription format and ranges
 */
export const validatePrescription = (prescriptionData) => {
  const results = {
    isValidFormat: true,
    hasRightEye: false,
    hasLeftEye: false,
    hasPD: false,
    sphereRange: true,
    cylinderRange: true,
    axisRange: true,
    pdRange: true,
    flags: []
  };

  try {
    // Check right eye
    if (prescriptionData.rightEye) {
      results.hasRightEye = true;
      
      // Validate sphere (-20 to +20)
      if (prescriptionData.rightEye.sphere) {
        const sphere = parseFloat(prescriptionData.rightEye.sphere);
        if (sphere < -20 || sphere > 20) {
          results.sphereRange = false;
          results.flags.push('Right eye sphere out of range (-20 to +20)');
        }
      }
      
      // Validate cylinder (-10 to +10)
      if (prescriptionData.rightEye.cylinder) {
        const cylinder = parseFloat(prescriptionData.rightEye.cylinder);
        if (cylinder < -10 || cylinder > 10) {
          results.cylinderRange = false;
          results.flags.push('Right eye cylinder out of range (-10 to +10)');
        }
      }
      
      // Validate axis (0 to 180)
      if (prescriptionData.rightEye.axis) {
        const axis = parseInt(prescriptionData.rightEye.axis);
        if (axis < 0 || axis > 180) {
          results.axisRange = false;
          results.flags.push('Right eye axis out of range (0 to 180)');
        }
      }
    }

    // Check left eye
    if (prescriptionData.leftEye) {
      results.hasLeftEye = true;
      
      // Validate sphere
      if (prescriptionData.leftEye.sphere) {
        const sphere = parseFloat(prescriptionData.leftEye.sphere);
        if (sphere < -20 || sphere > 20) {
          results.sphereRange = false;
          results.flags.push('Left eye sphere out of range (-20 to +20)');
        }
      }
      
      // Validate cylinder
      if (prescriptionData.leftEye.cylinder) {
        const cylinder = parseFloat(prescriptionData.leftEye.cylinder);
        if (cylinder < -10 || cylinder > 10) {
          results.cylinderRange = false;
          results.flags.push('Left eye cylinder out of range (-10 to +10)');
        }
      }
      
      // Validate axis
      if (prescriptionData.leftEye.axis) {
        const axis = parseInt(prescriptionData.leftEye.axis);
        if (axis < 0 || axis > 180) {
          results.axisRange = false;
          results.flags.push('Left eye axis out of range (0 to 180)');
        }
      }
    }

    // Check PD (pupillary distance)
    if (prescriptionData.pd) {
      results.hasPD = true;
      const pd = parseFloat(prescriptionData.pd);
      if (pd < 50 || pd > 80) {
        results.pdRange = false;
        results.flags.push('PD out of normal range (50-80mm)');
      }
    }

    // Check if at least one eye is present
    if (!results.hasRightEye && !results.hasLeftEye) {
      results.isValidFormat = false;
      results.flags.push('No eye prescription data found');
    }

    // Check for critical issues
    if (!results.sphereRange || !results.cylinderRange || !results.axisRange) {
      results.isValidFormat = false;
    }

    return results;
  } catch (error) {
    console.error('Error validating prescription:', error);
    results.isValidFormat = false;
    results.flags.push('Error validating prescription format');
    return results;
  }
};

/**
 * Submit prescription for verification
 */
export const submitForVerification = async (prescriptionId, userId) => {
  try {
    const prescription = await Prescription.findById(prescriptionId);
    
    if (!prescription) {
      throw new Error('Prescription not found');
    }

    if (prescription.user.toString() !== userId) {
      throw new Error('Unauthorized');
    }

    // Validate prescription
    const validationResults = validatePrescription(prescription);

    // Create verification record
    const verification = await PrescriptionVerification.create({
      prescription: prescriptionId,
      user: userId,
      status: validationResults.isValidFormat ? 'pending' : 'needs_review',
      validationResults
    });

    // Update prescription status
    prescription.verificationStatus = validationResults.isValidFormat ? 'pending' : 'needs_review';
    await prescription.save();

    return {
      success: true,
      verification,
      validationResults
    };
  } catch (error) {
    console.error('Error submitting prescription for verification:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Approve prescription verification
 */
export const approveVerification = async (verificationId, adminId, notes = '') => {
  try {
    const verification = await PrescriptionVerification.findById(verificationId)
      .populate('prescription');

    if (!verification) {
      throw new Error('Verification not found');
    }

    verification.status = 'approved';
    verification.verifiedBy = adminId;
    verification.adminNotes = notes;
    verification.verifiedAt = new Date();
    await verification.save();

    // Update prescription status
    verification.prescription.verificationStatus = 'approved';
    await verification.prescription.save();

    return {
      success: true,
      verification
    };
  } catch (error) {
    console.error('Error approving verification:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Reject prescription verification
 */
export const rejectVerification = async (verificationId, adminId, reason) => {
  try {
    const verification = await PrescriptionVerification.findById(verificationId)
      .populate('prescription');

    if (!verification) {
      throw new Error('Verification not found');
    }

    verification.status = 'rejected';
    verification.verifiedBy = adminId;
    verification.rejectionReason = reason;
    verification.verifiedAt = new Date();
    await verification.save();

    // Update prescription status
    verification.prescription.verificationStatus = 'rejected';
    await verification.prescription.save();

    return {
      success: true,
      verification
    };
  } catch (error) {
    console.error('Error rejecting verification:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get user's prescription verifications
 */
export const getUserVerifications = async (userId) => {
  try {
    const verifications = await PrescriptionVerification.find({ user: userId })
      .populate('prescription')
      .populate('verifiedBy', 'name email')
      .sort({ createdAt: -1 });

    return {
      success: true,
      verifications
    };
  } catch (error) {
    console.error('Error getting user verifications:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get all pending verifications (admin)
 */
export const getPendingVerifications = async () => {
  try {
    const verifications = await PrescriptionVerification.find({ 
      status: { $in: ['pending', 'needs_review'] } 
    })
      .populate('prescription')
      .populate('user', 'name email')
      .sort({ createdAt: 1 });

    return {
      success: true,
      verifications
    };
  } catch (error) {
    console.error('Error getting pending verifications:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get all verifications (admin)
 */
export const getAllVerifications = async (filters = {}) => {
  try {
    const verifications = await PrescriptionVerification.find(filters)
      .populate('prescription')
      .populate('user', 'name email')
      .populate('verifiedBy', 'name email')
      .sort({ createdAt: -1 });

    return {
      success: true,
      verifications
    };
  } catch (error) {
    console.error('Error getting all verifications:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export default {
  validatePrescription,
  submitForVerification,
  approveVerification,
  rejectVerification,
  getUserVerifications,
  getPendingVerifications,
  getAllVerifications
};
