const axios = require('axios');
const xml2js = require('xml2js');
const { Kafka } = require('kafkajs');


const kafkaBroker = process.env.KAFKA_BROKER || 'localhost:29092';
const kafka = new Kafka({
    clientId: 'sitemap-crawler',
    brokers: [kafkaBroker]
});

const producer = kafka.producer();
const target_topic = 'product-urls';

async function downloadSitemap(url) {
    try {
        console.log(`Downloading sitemap  ${url} ...`);
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        console.error(`Failed to download ${url}: ${error.message}`);
        return null;
    }
}

async function getUrlsFromMainSitemap(xmlData) {
    try {
        console.log('Parsing XML data  from main sitemap ...');
        const parser = new xml2js.Parser({ explicitArray: false });
        const result = await parser.parseStringPromise(xmlData);
        const sitemaps = result.sitemapindex.sitemap;
        return sitemaps.map(sitemap => sitemap.loc);
    } catch (error) {
        console.error(`Error parsing XML: ${error.message}`);
        return [];
    }
}

async function getCettireSitemaps() {
    const mainSitemapUrl = 'https://www.cettire.com/sitemap.xml';
    try {
        console.log(`Processing main sitemap: ${mainSitemapUrl}`);
        const mainSitemapData = await downloadSitemap(mainSitemapUrl);
        const sitemapUrls = await getUrlsFromMainSitemap(mainSitemapData);
        console.log(`Found ${sitemapUrls.length} sitemaps. Start processing ...`);
        const sitemapDataArray = await Promise.all(
            sitemapUrls.map(async (url) => {
                const data = await downloadSitemap(url);
                return { url, data };
            })
        );
        return sitemapDataArray.filter(item => item.data);
    } catch (error) {
        console.error(`Failed to process main sitemap: ${error.message}`);
        return [];
    }
}

const publishProductUrlFromSitemaps = async (sitemapDataArray) => {
    console.log('Publishing product URLs to Kafka ...');

    try {
        await producer.connect();
        
        const processSitemap = async ({ url, data }) => {
            try {
                const parser = new xml2js.Parser();
                const result = await parser.parseStringPromise(data);
                const urlset = result.urlset.url;

                // Create an array of messages
                const messages = urlset.map(url => ({ value: url.loc.toString() }));

                // Send messages in batches
                const batchSize = 100; // Adjust the batch size based on your performance testing
                for (let i = 0; i < messages.length; i += batchSize) {
                    const batch = messages.slice(i, i + batchSize);
                    await producer.send({
                        topic: target_topic,
                        messages: batch
                    });
                }

                console.log(`Published ${messages.length} URLs from sitemap: ${url}`);
            } catch (parseError) {
                console.error(`Error parsing sitemap for URL: ${url}`, parseError);
            }
        };

        // Process all sitemaps concurrently with a limit
        const concurrencyLimit = 10; // Adjust the concurrency limit based on your performance testing
        const sitemapChunks = [];

        for (let i = 0; i < sitemapDataArray.length; i += concurrencyLimit) {
            sitemapChunks.push(sitemapDataArray.slice(i, i + concurrencyLimit));
        }

        for (const chunk of sitemapChunks) {
            await Promise.all(chunk.map(processSitemap));
        }

    } catch (connectionError) {
        console.error('Error connecting to Kafka', connectionError);
    } finally {
        try {
            await producer.disconnect();
        } catch (disconnectError) {
            console.error('Error disconnecting from Kafka', disconnectError);
        }
    }
};

(async () => {
    try {
        console.log('Starting sitemap processing ...');
        const sitemapDataArray = await getCettireSitemaps();
        await publishProductUrlFromSitemaps(sitemapDataArray);
    } catch (error) {
        console.error(`An error occurred: ${error.message}`);
    }
})();