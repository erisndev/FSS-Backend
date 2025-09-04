import Notification from '../models/Notification.js';

export const listMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user._id }).sort('-createdAt');
    res.json(notifications);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const n = await Notification.findOne({ _id: id, user: req.user._id });
    if (!n) return res.status(404).json({ message: 'Not found' });
    n.isRead = true;
    await n.save();
    res.json(n);
  } catch (e) { res.status(500).json({ message: e.message }); }
};
