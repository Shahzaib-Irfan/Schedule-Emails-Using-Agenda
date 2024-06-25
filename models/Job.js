const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema({
  emailTo: { type: String, required: true },
  subject: { type: String, required: true },
  body: { type: String, required: true },
  cronExpression: { type: String, required: true },
  jobStartDate: { type: Date, required: true },
  jobEndDate: { type: Date, required: true },
  status: { type: String, default: "pending" },
  retries: { type: Number, default: 0 },
  retryCount: { type: Number, default: 0 },
  lastRunAt: { type: Date },
  lastFinishedAt: { type: Date },
});

module.exports = mongoose.model("Job", jobSchema);
