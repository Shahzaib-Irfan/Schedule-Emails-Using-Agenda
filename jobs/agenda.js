require("dotenv").config();
const Agenda = require("agenda");
const nodemailer = require("nodemailer");
const Job = require("../models/Job");
const cronParser = require("cron-parser");

const mongoConnectionString = process.env.MONGODB_URI;

const agenda = new Agenda({
  db: { address: mongoConnectionString, collection: "jobs" },
  processEvery: "1 minute",
  maxConcurrency: 20,
});

// Setup email transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Define the job to send email
agenda.define(
  "send email",
  { priority: "high", concurrency: 10 },
  async (job) => {
    const { emailTo, subject, body, cronExpression, jobEndDate } =
      job.attrs.data;

    const now = new Date();
    if (now > new Date(jobEndDate)) {
      await Job.findByIdAndUpdate(job.attrs._id, { status: "completed" });
      return;
    }

    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: emailTo,
        subject: subject,
        text: body,
      });
      await Job.findByIdAndUpdate(job.attrs._id, {
        status: "sent",
        lastFinishedAt: new Date(),
      });

      const nextRun = cronParser
        .parseExpression(cronExpression)
        .next()
        .toDate();
      if (nextRun < new Date(jobEndDate)) {
        job.schedule(nextRun);
        await job.save();
      }
    } catch (error) {
      job.attrs.failCount = job.attrs.failCount ? job.attrs.failCount + 1 : 1;
      job.fail(error.message);
      await Job.findByIdAndUpdate(job.attrs._id, {
        status: "failed",
        retries: job.attrs.failCount,
      });
    }
  }
);

// Handle job failure
agenda.on("fail:send email", async (err, job) => {
  const retryLimit = 5;
  if (job.attrs.failCount < retryLimit) {
    job.schedule("in 1 minute");
    await job.save();
  } else {
    await Job.findByIdAndUpdate(job.attrs._id, {
      status: "failed permanently",
    });
  }
});

// Handle job success
agenda.on("success:send email", async (job) => {
  await Job.findByIdAndUpdate(job.attrs._id, {
    status: "sent",
    lastFinishedAt: new Date(),
  });
});

// Start agenda
(async function () {
  await agenda.start();
})();

module.exports = agenda;
