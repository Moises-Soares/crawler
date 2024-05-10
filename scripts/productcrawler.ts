import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as csv from 'csv-writer';

interface Product {
    url: string;
    price: string;
}

async function scrapePrices(urls: string[]): Promise<Product[]> {
    const browser = await puppeteer.launch({ headless: true });
    const products: Product[] = [];

    for (const url of urls) {
        const page = await browser.newPage();
        await page.goto(url);
        



        

        // Wait for the price element to ensure it has loaded
        await page.waitForSelector('#product-detail--price');

        const  variableName : string  = 'e';
        // Get the value of the global variable
        const globalVariableValue = await page.evaluate((variableName) => {
            return window;
        }, variableName);

        console.log(`Value of ${variableName} on ${url}:`, globalVariableValue);
        

        // Get the price
        const price = await page.evaluate(() => {
            const priceElement = document.querySelector('#product-detail--price');
            return priceElement ? priceElement.textContent : 'Price not found';
        });

        products.push({ url, price });

        await page.close();
    }

    await browser.close();

    return products;
}

async function saveToCSV(products: Product[], outputPath: string): Promise<void> {
    const csvWriter = csv.createObjectCsvWriter({
        path: outputPath,
        header: [
            { id: 'url', title: 'URL' },
            { id: 'price', title: 'Price' }
        ],
        append: fs.existsSync(outputPath) // Append if file exists
    });

    await csvWriter.writeRecords(products);
}


// Example usage
const urls = [
    'https://www.cettire.com/products/palm-angels-kids-logo-print-hooded-overshirt-99005379',
    'https://www.cettire.com/products/doucals-glattleder-lace-up-sneakers-925868595',
    'https://www.cettire.com/products/isabel-marant-biani-embroidered-top-925486171'
];

(async () => {
    try {
        const products = await scrapePrices(urls);
        await saveToCSV(products, 'products.csv');
        console.log('Data saved to products.csv');
    } catch (error) {
        console.error('Error:', error);
    }
})();