function setupErrorHandlers() {
    process.on('uncaughtException', error => console.error(`Caught exception: ${error}`));
    process.on('unhandledRejection', (reason, promise) => console.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`));
}

module.exports = { setupErrorHandlers };
