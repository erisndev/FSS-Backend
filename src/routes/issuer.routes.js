// routes/issuer.routes.js
import { Router } from "express";
import { protect, authorize } from "../middleware/auth.js";
import { getBiddersForMyTenders } from "../controllers/issuer.controller.js";

const router = Router();

router.get("/bidders", protect, authorize("issuer"), getBiddersForMyTenders);

export default router;
