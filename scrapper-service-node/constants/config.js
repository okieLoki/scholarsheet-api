export const config = {
  LOG_LEVEL: "info",
  DATABASE_URL: "mongodb://localhost:27017/capstone",
  RABBITMQ_URL: "amqp://guest:guest@localhost:5672/",
};

export const queues = {
    RESEACHER_QUEUE: "researcher-queue"
}