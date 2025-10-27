const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            // Connection pooling settings
            maxPoolSize: 50, // Maximum number of connections in pool
            minPoolSize: 5,  // Minimum number of connections in pool
            maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
            serverSelectionTimeoutMS: 5000, // How long to try selecting a server
            socketTimeoutMS: 45000, // How long a send or receive on a socket can take
            heartbeatFrequencyMS: 10000, // How often to check server status

            // Retry settings
            retryWrites: true,
            retryReads: true,
        });

        // Set mongoose-specific buffer settings (only the supported one)
        mongoose.set('bufferCommands', false);

        console.log("MongoDB connected with optimized pool settings.");
        console.log("Connection ready state:", mongoose.connection.readyState);

        // Monitor connection events
        mongoose.connection.on('connected', () => {
            console.log('MongoDB connected successfully');
        });

        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.log('MongoDB disconnected');
        });

        // Graceful shutdown
        process.on('SIGINT', async () => {
            await mongoose.connection.close();
            console.log('MongoDB connection closed through app termination');
            process.exit(0);
        });

    } catch (err) {
        console.error('MongoDB connection failed:', err.message);
        process.exit(1);
    }
};

module.exports = connectDB;
