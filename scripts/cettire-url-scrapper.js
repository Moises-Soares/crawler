const puppeteer = require('puppeteer');
const fs = require("fs");
const path = require("path");

async function scrap(url) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Ensure the directory exists
    const dir = path.resolve(__dirname, 'cettire-products');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }

    // Enable request interception to monitor requests
    await page.setRequestInterception(true);

    // Listen for requests and continue them
    page.on('request', interceptedRequest => {
        interceptedRequest.continue();
    });

    // Listen for responses and log their contents if they match the GraphQL endpoint
    page.on('response', async response => {
        if (response.url().includes('https://api.cettire.com/graphql') && response.ok()) {  // Check if the response is successful
            try {
                const contentType = response.headers()['content-type'];  // Get the content type of the response
                if (contentType && contentType.includes('application/json')) {
                    const jsonResponse = await response.json();  // Asynchronously get the JSON data from the response
                    if (jsonResponse.data.catalogItemProduct) {
                        let product = jsonResponse.data.catalogItemProduct.product;
                        let timestamp = new Date().toISOString();
                        let fileNewName = `${timestamp}-${product.productId}.json`;
                        let targetFileName = path.resolve(dir, fileNewName);

                        // Write JSON to file
                        fs.writeFileSync(targetFileName, JSON.stringify(product, null, 2));
                        console.log('Data written successfully to JSON:', targetFileName);

                        // Flush and close the file descriptor to ensure data is written immediately
                        const fd = fs.openSync(targetFileName, 'r');
                        fs.fsyncSync(fd);
                        fs.closeSync(fd);
                    }
                }
            } catch (error) {
                console.error('Error reading response:', error.message);
            }
        }
    });

    await page.goto(url); // Use the provided URL

    // Wait a bit to ensure all requests and responses are captured before closing the browser
    await page.evaluate(() => {
        return new Promise(resolve => setTimeout(resolve, 10000)); // waits for 10,000 milliseconds
    });

    await browser.close();
}

module.exports = scrap;
