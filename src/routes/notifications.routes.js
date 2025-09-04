import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { listMyNotifications, markAsRead } from '../controllers/notifications.controller.js';

const router = Router();

router.get('/', protect, listMyNotifications);
router.put('/:id/read', protect, markAsRead);

export default router;
