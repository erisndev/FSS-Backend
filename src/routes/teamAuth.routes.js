import express from "express";
import {
  getTeamMembersForLogin,
  teamLogin,
} from "../controllers/teamAuth.controller.js";

const router = express.Router();

// Step 1: Get team members for shared email
router.post("/team-members", getTeamMembersForLogin);

// Step 2: Login with member selection
router.post("/team-login", teamLogin);

export default router;
