const express = require("express");
const router = express.Router();
const jobController = require("../controllers/jobController");

router.post("/jobs", jobController.createJob);
router.get("/jobs", jobController.getJobs);
router.get("/jobs/recent", jobController.getRecentCompletedJobs); // New route
router.get("/jobs/recent/:id", jobController.getSingleCompletedJobs); // New route

module.exports = router;
