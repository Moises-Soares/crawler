const { ServiceBroker } = require("moleculer");

// Create broker
const broker = new ServiceBroker({
    nodeID: "node-1",
    transporter: "nats://localhost:4222", 
    logger: console,
    logLevel: "info",
});

// Load services
broker.loadService("./services/service-a.service.js");
broker.loadService("./services/service-b.service.js");

// Start broker
broker.start()
    .then(() => {
        broker.repl();
    })
    .catch(err => {
        broker.logger.error("Error starting broker", err);
    });