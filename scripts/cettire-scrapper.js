const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const scrap = require('./cettire-url-scrapper');

// Function to read files starting with 'sitemap_products'
const readSitemapFiles = async (directory) => {
    const files = fs.readdirSync(directory).filter(file => file.startsWith('sitemap_products'));
    let urls = [];

    for (const file of files) {
        const filePath = path.join(directory, file);
        const data = fs.readFileSync(filePath, 'utf-8');

        // Parse the XML content
        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(data);

        // Extract URLs and add to the array
        const urlset = result.urlset.url;
        urlset.forEach(url => {
            urls.push(url.loc[0]);
        });
    }

    return urls;
};

// Function to process URLs with concurrency control
const processUrls = async (urls, concurrencyLimit) => {
    let activeCount = 0;
    let index = 0;

    const next = async () => {
        if (index >= urls.length) return;

        while (activeCount < concurrencyLimit && index < urls.length) {
            const url = urls[index++];
            activeCount++;

            (async () => {
                try {
                    await scrap(url);
                    console.log(`Processed: ${url}`);
                } catch (err) {
                    console.error(`Error processing ${url}:`, err);
                } finally {
                    activeCount--;
                    next(); // Trigger next call when one finishes
                }
            })();
        }
    };

    // Initialize the first set of concurrent calls
    next();
};

// Usage
const directoryPath = path.resolve(__dirname, 'cettire-sitemap');
readSitemapFiles(directoryPath).then(urls => {
    const concurrencyLimit = 10; // Number of concurrent calls allowed
    processUrls(urls, concurrencyLimit);
}).catch(err => {
    console.error('Error reading sitemap files:', err);
});
