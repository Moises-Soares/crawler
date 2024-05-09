const axios = require('axios');
const xml2js = require('xml2js');
const fs = require('fs');
const path = require('path');

// Function to download a file and save it locally
async function downloadFile(url, filename) {
    try {
        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream'
        });
        // target file should be saved in the same directory inside sitemaps folder
        const targetFile = path.resolve(__dirname, 'sitemaps');
        const writer = fs.createWriteStream(path.resolve(targetFile, filename));
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    } catch (error) {
        console.error(`Failed to download ${url}: ${error.message}`);
    }
}

// Function to parse XML and extract sitemap links
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

// Main function to handle the sitemap download and processing
async function processSitemaps() {
    const mainSitemapUrl = 'https://www.cettire.com/sitemap.xml';
    try {
        // Download the main sitemap
        const response = await axios.get(mainSitemapUrl);
        const sitemapUrls = await parseSitemaps(response.data);

        // Process each sitemap URL found
        for (let url of sitemapUrls) {
            const filename = url.split('/').pop(); // Extract filename from URL
            await downloadFile(url, filename);
            console.log(`Downloaded ${filename}`);
        }
    } catch (error) {
        console.error(`Failed to process main sitemap: ${error.message}`);
    }
}

// Run the main function
processSitemaps();

