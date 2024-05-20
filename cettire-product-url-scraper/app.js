const { Kafka } = require('kafkajs');
const puppeteer = require('puppeteer');
const { Semaphore } = require('async-mutex');

// Kafka configuration
const kafkaBroker = process.env.KAFKA_BROKER || 'localhost:29092';
const sourceTopic = 'product-urls';
const targetTopic = 'cettire-product';

// Puppeteer executable path configuration
if (!process.env.CHROME_BIN) {
    console.warn('CHROME_BIN environment variable is not set. Using default path for Google Chrome.');
    process.env.CHROME_BIN = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
}

// Initialize Kafka
const kafka = new Kafka({
    clientId: 'cettire-product-scraper',
    brokers: [kafkaBroker]
});

const consumer = kafka.consumer({ groupId: 'cettire-product-scraper-group' });
const producer = kafka.producer();
const semaphore = new Semaphore(10); // Adjust the concurrency limit as needed
let browser;

// Main function to run the consumer
const run = async () => {
    try {
        await consumer.connect();
        await producer.connect();
        await consumer.subscribe({ topic: sourceTopic, fromBeginning: true });

        // Launch the browser once
        browser = await puppeteer.launch({
            headless: true,
            executablePath: process.env.CHROME_BIN
        });

        await consumer.run({
            eachBatch: async ({ batch }) => {
                const promises = batch.messages.map(message => handleMessage(message));
                await Promise.all(promises);
            }
        });

        process.on('SIGINT', async () => {
            console.log('Caught interrupt signal, shutting down...');
            await consumer.disconnect();
            await producer.disconnect();
            if (browser) {
                await browser.close();
            }
            process.exit(0);
        });
    } catch (error) {
        console.error('Error in Kafka consumer/producer setup:', error.message);
        process.exit(1);
    }
};

// Function to handle each message
const handleMessage = async (message) => {
    const url = message.value.toString();
    console.log(`Consumed message with URL: ${url}`);

    if (!url || !url.includes('products')) {
        console.log('Not a product URL or empty URL - skipping scraping');
        return;
    }

    await semaphore.runExclusive(() => scrape(url));
};

// Function to scrape the product data
const scrape = async (url) => {
    let page;
    try {
        page = await browser.newPage();
        await setupInterception(page);

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // Replace page.waitForTimeout with a manual timeout
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait to ensure all requests and responses are captured
    } catch (error) {
        console.error(`Error scraping URL ${url}:`, error.message);
    } finally {
        if (page) {
            await page.close();
        }
    }
};

// Function to set up request and response interception
const setupInterception = async (page) => {
    await page.setRequestInterception(true);
    page.on('request', (request) => {
        if (['image', 'font'].includes(request.resourceType())) {
            request.abort();
        } else {
            if (request.url().includes('https://api.cettire.com/graphql')) {
                //console.log('Intercepted GraphQL request:');
            }
            request.continue();
        }
    });

    page.on('response', async (response) => {
        if (!response.url().includes('https://api.cettire.com/graphql') || !response.ok()) return;

        try {
            const contentType = response.headers()['content-type'];
            if (!contentType || !contentType.includes('application/json')) {
                console.log('Not a JSON response');
                return;
            }

            const jsonResponse = await response.json();
            if (!jsonResponse.data || !jsonResponse.data.catalogItemProduct) {
                console.log('No product data found in response');
                return;
            }

            const product = jsonResponse.data.catalogItemProduct.product;
            console.log('Publishing product...');
            await producer.send({
                topic: targetTopic,
                messages: [{ value: JSON.stringify(product) }]
            });
        } catch (ex) {
            console.error('Error reading response:', ex.message);
        }
    });
};

// Start the consumer
run().catch(console.error);
