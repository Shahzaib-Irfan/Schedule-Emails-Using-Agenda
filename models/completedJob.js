const mongoose = require("mongoose");

const completedJobSchema = new mongoose.Schema({
  jobID: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
  cronExpression: { type: String, required: true },
  status: { type: String, required: true },
  lastFinishedAt: { type: Date },
  startTime: { type: Date },
  duration: { type: Number },
  failReason: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("CompletedJob", completedJobSchema);
