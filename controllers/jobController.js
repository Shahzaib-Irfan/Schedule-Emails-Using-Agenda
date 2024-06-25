const Job = require("../models/Job");
const agenda = require("../jobs/agenda");
const cronParser = require("cron-parser");

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
    const jobs = await Job.find();
    res.status(200).json(jobs);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
