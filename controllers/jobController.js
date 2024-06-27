const Job = require("../models/Job");
const agenda = require("../jobs/agenda");
const cronParser = require("cron-parser");
const CompletedJob = require("../models/completedJob");

exports.createJob = async (req, res) => {
  const { emailTo, subject, body, cronExpression, jobStartDate, jobEndDate } =
    req.body;
  try {
    const job = new Job({
      emailTo,
      subject,
      body,
      cronExpression,
      jobStartDate,
      jobEndDate,
    });
    await job.save();

    const startDate = new Date(jobStartDate);
    if (startDate > new Date()) {
      await agenda.schedule(startDate, "send email", job);
    } else {
      // Schedule the job based on the cron expression from the current time
      const nextRun = cronParser
        .parseExpression(cronExpression)
        .next()
        .toDate();
      await agenda.schedule(nextRun, "send email", job);
    }

    res.status(201).json(job);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getJobs = async (req, res) => {
  try {
    const jobs = await Job.find({
      name: { $exists: true },
      lastFinishedAt: { $exists: true },
      name: "send email",
    });
    res.status(200).json(jobs);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getRecentCompletedJobs = async (req, res) => {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const jobs = await CompletedJob.find({
      createdAt: { $gte: oneHourAgo },
    }).populate("jobID");

    const jobData = jobs.map((job) => ({
      jobID: job.jobID._id,
      cronExpression: job.cronExpression,
      status: job.status,
      lastFinishedAt: job.lastFinishedAt,
      startTime: job.startTime,
      duration: job.duration,
    }));

    res.status(200).json(jobData);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getSingleCompletedJobs = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(id);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const jobs = await CompletedJob.find({
      createdAt: { $gte: oneHourAgo },
      jobID: id,
    });
    console.log(jobs);
    const jobData = jobs.map((job) => ({
      jobID: job.jobID,
      cronExpression: job.cronExpression,
      status: job.status,
      lastFinishedAt: job.lastFinishedAt,
      startTime: job.startTime,
      duration: job.duration,
      failReason: job.failReason, // Add failReason to the response
    }));

    res.status(200).json(jobData);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
