import mongoose from 'mongoose';

const prescriptionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  patientName: { type: String },
  doctorName: { type: String },
  doctorEmail: { type: String },
  dateOfExamination: { type: Date },
  rightEye: {
    sphere: { type: Number },
    cylinder: { type: Number },
    axis: { type: Number, min: 0, max: 180 },
    addition: { type: Number },
    prism: { type: String },
    base: { type: String }
  },
  leftEye: {
    sphere: { type: Number },
    cylinder: { type: Number },
    axis: { type: Number, min: 0, max: 180 },
    addition: { type: Number },
    prism: { type: String },
    base: { type: String }
  },
  pd: { type: Number },
  nearPd: { type: Number },
  type: {
    type: String,
    enum: ['single-vision', 'bifocal', 'progressive', 'reading', 'computer'],
    default: 'single-vision'
  },
  fileUrl: { type: String },
  isValidated: { type: Boolean, default: false },
  validatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  validatedAt: { type: Date },
  validationNotes: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  notes: { type: String, default: '' }
}, {
  timestamps: true
});

prescriptionSchema.index({ user: 1, isActive: 1 });

const Prescription = mongoose.model('Prescription', prescriptionSchema);
export default Prescription;
