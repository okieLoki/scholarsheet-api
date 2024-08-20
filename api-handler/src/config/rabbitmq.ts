import amqp from "amqplib";
import { config } from "./index";
import { l } from "./logger";

class RabbitMQ {
    
    private channel: amqp.Channel | null = null;

    public async rabbitmqConnect() {
        try {
            const connection = await amqp.connect(config.RABBITMQ_URL);
            this.channel = await connection.createChannel();

            l.info("Connected to RabbitMQ");

        } catch (error) {
            l.error(`Error connecting to RabbitMQ: ${error}`);
        }
    }

    public async publish(queue: string, message: string) {
        this.channel?.assertQueue(queue, { durable: true });
        this.channel?.sendToQueue(queue, Buffer.from(message), { persistent: true });
    }

    public async consume(queue: string, callback: (message: amqp.ConsumeMessage | null) => void) {
        this.channel?.assertQueue(queue, { durable: true });

        console.log("Listening for articles");
    
        this.channel?.consume(queue, callback);
    }

    public async ack(message: amqp.ConsumeMessage) {
        this.channel?.ack(message);
    }

    public async close() {
        await this.channel?.close();
    }
}

export const rabbitmq = new RabbitMQ();