const { Kafka } = require('kafkajs');
const puppeteer = require('puppeteer');
require('dotenv').config();

const kafkaBroker = process.env.KAFKA_BROKER || 'localhost:29092';
const sourceTopic = 'product-urls';
const targetTopic = 'cettire-product';

(async () => {
    if (!process.env.CHROME_BIN) {
        process.env.CHROME_BIN = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    }

    const kafka = new Kafka({
        clientId: 'my-app',
        brokers: [kafkaBroker]
    });

    const consumer = kafka.consumer({ groupId: 'cettire-product-scraper-group' });
    const producer = kafka.producer();

    const consumeMessages = async () => {
        await consumer.subscribe({ topic: sourceTopic, fromBeginning: true });

        await consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                const url = message.value.toString();
                console.log(`Consumed message with Url: ${url}`);
                if (url) {
                    try {
                        await scrap(url, producer, targetTopic);
                    } catch (error) {
                        console.error(`Error in scraping: ${error}`);
                    }
                }
            }
        });
    };

    await consumer.connect();
    await producer.connect();
    await consumeMessages();

    process.on('SIGINT', async () => {
        console.log('Disconnecting consumer and producer...');
        await consumer.disconnect();
        await producer.disconnect();
        process.exit();
    });
})();

const scrap = async (url, producer, topic) => {
    if (!url.includes('products')) {
        console.log('Not a product URL - skipping scraping for: ' + url);
        return;
    }

    const executablePath = process.env.CHROME_BIN;

    const browser = await puppeteer.launch({
        headless: true,
        executablePath: executablePath
    });

    const page = await browser.newPage();

    await page.setRequestInterception(true);

    page.on('request', (request) => {
        if (request.resourceType() === 'image' || request.resourceType() === 'font') {
            request.abort();
        } else {
            request.continue();
        }
    });

    page.on('response', async (response) => {
        if (response.url().includes('https://api.cettire.com/graphql') && response.ok()) {
            try {
                const contentType = response.headers()['content-type'];
                if (contentType && contentType.includes('application/json')) {
                    const jsonResponse = await response.json();
                    if (jsonResponse.data.catalogItemProduct) {
                        const product = jsonResponse.data.catalogItemProduct.product;
                        console.log('Publishing product...');
                        await producer.send({
                            topic: topic,
                            messages: [
                                { value: JSON.stringify(product) }
                            ]
                        });
                    } else {
                        console.log('No product data found in response');
                    }
                } else {
                    console.log('Not a JSON response');
                }
            } catch (ex) {
                console.error('Error reading response: ' + ex.message);
            }
        }
    });

    await page.goto(url);

    // Wait a bit to ensure all requests and responses are captured before closing the browser
    await page.waitForTimeout(5000);

    await browser.close();
};
