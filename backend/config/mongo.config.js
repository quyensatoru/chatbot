import mongoose from 'mongoose';

let mongodb;

const connectToMongoDB = async () => {
    if (mongodb) {
        return mongodb;
    }

    try {
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
        await mongoose.connect(uri, { autoIndex: true });
        mongodb = await mongoose.connection;
        console.log('Connected to MongoDB');
        return mongodb;
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
        throw error;
    }
};

export default connectToMongoDB;
