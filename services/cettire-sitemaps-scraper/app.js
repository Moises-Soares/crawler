const axios = require('axios');
const xml2js = require('xml2js');
const { Kafka } = require('kafkajs');

// Kafka configuration using environment variable
const kafkaBroker = process.env.KAFKA_BROKER || 'kafka:9092';
const kafka = new Kafka({
    clientId: 'sitemap-crawler',
    brokers: [kafkaBroker]
});
const producer = kafka.producer();
const topic = 'product-urls';

async function downloadFile(url) {
    try {
        console.log(`Downloading ${url}...`);
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        console.error(`Failed to download ${url}: ${error.message}`);
        return null;
    }
}

async function parseSitemaps(xmlData) {
    try {
        const parser = new xml2js.Parser({ explicitArray: false });
        const result = await parser.parseStringPromise(xmlData);

        const sitemaps = result.sitemapindex.sitemap;
        return sitemaps.map(sitemap => sitemap.loc);
    } catch (error) {
        console.error(`Error parsing XML: ${error.message}`);
        return [];
    }
}

async function downloadCettireSitemaps() {
    const mainSitemapUrl = 'https://www.cettire.com/sitemap.xml';
    try {
        // Download the main sitemap
        const mainSitemapData = await downloadFile(mainSitemapUrl);
        const sitemapUrls = await parseSitemaps(mainSitemapData);

        // Process each sitemap URL found
        const sitemapDataArray = await Promise.all(
            sitemapUrls.map(async (url) => {
                const data = await downloadFile(url);
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
    await producer.connect();

    for (const { url, data } of sitemapDataArray) {
        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(data);

        // Extract URLs and publish them to Kafka
        const urlset = result.urlset.url;
        for (const url of urlset) {
            const message = {
                value: url.loc.toString()  // Ensure the value is a string
            };
            
            console.log(`Publishing URL: ${message.value}`);

     

        }
    }

    await producer.disconnect();
};

(async () => {
    try {
        const sitemapDataArray = await downloadCettireSitemaps();
        await publishProductUrlFromSitemaps(sitemapDataArray);
    } catch (error) {
        console.error(`An error occurred: ${error.message}`);
    }
})();