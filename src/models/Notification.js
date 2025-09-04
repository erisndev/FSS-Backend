import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['system','tender','application'], default: 'system' },
  title: { type: String, required: true },
  body: { type: String },
  isRead: { type: Boolean, default: false },
  meta: { type: Object }
}, { timestamps: true });

export default mongoose.model('Notification', notificationSchema);
