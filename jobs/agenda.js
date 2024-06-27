const Agenda = require("agenda");
const nodemailer = require("nodemailer");
const Job = require("../models/Job");
const CompletedJob = require("../models/completedJob");
const cronParser = require("cron-parser");

const mongoConnectionString = process.env.MONGODB_URI;

const agenda = new Agenda({
  db: { address: mongoConnectionString, collection: "jobs" },
  processEvery: "1 minute",
  maxConcurrency: 20,
});

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

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

    const startTime = now;

    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: emailTo,
        subject: subject,
        text: body,
      });

      const curr_date = new Date();
      const duration = (curr_date - startTime) / 1000;
      const completedJobData = {
        jobID: job.attrs._id,
        cronExpression: job.attrs.data.cronExpression,
        status: "success",
        lastFinishedAt: curr_date,
        startTime: startTime,
        failReason: "",
        duration,
      };
      await CompletedJob.create(completedJobData);
      await Job.findByIdAndUpdate(job.attrs._id, {
        status: "sent",
        lastFinishedAt: new Date(),
        duration,
      });
    } catch (error) {
      job.attrs.failCount = job.attrs.failCount ? job.attrs.failCount + 1 : 1;
      job.fail(error.message);

      const duration = (new Date() - startTime) / 1000;
      const completedJobData = {
        jobID: job.attrs._id,
        cronExpression: job.attrs.data.cronExpression,
        status: "failed",
        lastFinishedAt: new Date(),
        startTime: startTime,
        failReason: error.message,
        duration,
      };
      await CompletedJob.create(completedJobData);
      await Job.findByIdAndUpdate(job.attrs._id, {
        status: "failed",
        retries: job.attrs.failCount,
        duration,
      });
    }

    const nextRun = cronParser.parseExpression(cronExpression).next().toDate();
    if (nextRun < new Date(jobEndDate)) {
      job.schedule(nextRun);
      await job.save();
    }
  }
);

agenda.on("fail:send email", async (err, job) => {
  await Job.findByIdAndUpdate(job.attrs._id, {
    status: "failed",
    lastFinishedAt: new Date(),
  });
  const retryLimit = 5;
  if (job.attrs.failCount < retryLimit) {
    job.attrs.nextRunAt = new Date();
    await job.save();
  } else {
    await Job.findByIdAndUpdate(job.attrs._id, {
      status: "failed permanently",
    });
  }
});

agenda.on("success:send email", async (job) => {
  await Job.findByIdAndUpdate(job.attrs._id, {
    status: "sent",
    lastFinishedAt: new Date(),
  });
});

agenda.define("cleanup completed jobs", async () => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  await CompletedJob.deleteMany({ createdAt: { $lt: oneHourAgo } });
});

(async function () {
  await agenda.start();
  await agenda.every("1 hour", "cleanup completed jobs");
})();

module.exports = agenda;
