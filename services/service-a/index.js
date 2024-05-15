const { Kafka } = require('kafkajs');

const kafkaBroker = process.env.KAFKA_BROKER || 'kafka:9092';

// Create a Kafka instance
const kafka = new Kafka({
    clientId: 'service-a',
    brokers: [kafkaBroker]
});

// Create a producer
const producer = kafka.producer();

const run = async () => {
    // Connect the producer
    await producer.connect();

    // Set an interval to send messages every second
    setInterval(async () => {
        try {
            console.log('Sending message...');
            await producer.send({
                topic: 'Hello-Kafka-Topic',
                messages: [
                    { value: 'hello from service a' },
                ],
            });
            console.log('Message sent: hello from service a');
        } catch (err) {
            console.error('Error sending message', err);
        }
    }, 1000);
};

run().catch(console.error);
