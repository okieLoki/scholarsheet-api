export const config = {
  LOG_LEVEL: "info",
  DATABASE_URL:
    "mongodb+srv://uddeepta:uddeepta@cluster0.eiezn.mongodb.net/capstone",
  RABBITMQ_URL: "amqp://guest:guest@localhost:5672/",
};

export const queues = {
  RESEARCHER_QUEUE: "researcher-queue",
  CALCULATION_QUEUE: "calculations-queue",
};
