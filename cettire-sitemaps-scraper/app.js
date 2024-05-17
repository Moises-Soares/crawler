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
    await producer.connect();
    for (const { url, data } of sitemapDataArray) {
        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(data);
        const urlset = result.urlset.url;
        for (const url of urlset) {
            const message = {
                value: url.loc.toString() 
            };
             producer.send({
                 topic: target_topic,
                 messages: [message]
             }).then(r => console.log(`Published: ${message.value}`));
        }
    }
    await producer.disconnect();
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