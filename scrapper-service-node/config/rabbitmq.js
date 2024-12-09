import amqp from "amqplib";
import { config } from "../constants/config.js";
import { l } from "./logger.js";

class RabbitMQ {
  constructor() {
    this.channel = null;
  }

  async rabbitmqConnect() {
    try {
      const connection = await amqp.connect(config.RABBITMQ_URL);
      this.channel = await connection.createChannel();

      l.info("Connected to RabbitMQ");
    } catch (error) {
      l.error(`Error connecting to RabbitMQ: ${error}`);
    }
  }

  async publish(queue, message) {
    if (this.channel) {
      await this.channel.assertQueue(queue, { durable: true });
      this.channel.sendToQueue(queue, Buffer.from(message), {
        persistent: true,
      });
    } else {
      l.error("Cannot publish message. Channel is not initialized.");
    }
  }

  async consume(queue, callback) {
    if (this.channel) {
      await this.channel.assertQueue(queue, { durable: true });
      console.log("Listening for articles");

      this.channel.consume(queue, callback);
    } else {
      l.error("Cannot consume messages. Channel is not initialized.");
    }
  }

  async ack(message) {
    if (this.channel) {
      this.channel.ack(message);
    } else {
      l.error("Cannot acknowledge message. Channel is not initialized.");
    }
  }

  async close() {
    if (this.channel) {
      await this.channel.close();
    } else {
      l.error("Cannot close channel. Channel is not initialized.");
    }
  }

  async nack(message) {
    if (this.channel) {
      this.channel.nack(message, false, false);
    } else {
      l.error("Cannot nack message. Channel is not initialized.");
    }
  }
}

export const rabbitMq = new RabbitMQ();
