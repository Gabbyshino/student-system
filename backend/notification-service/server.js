const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const amqp = require('amqplib');

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());

// ============================================
// MONGODB CONNECTION
// ============================================
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB Connected successfully'))
    .catch(err => {
        console.log('❌ MongoDB Connection Error:', err.message);
        console.log('💡 Make sure MongoDB is running!');
        console.log('⚠️  Notifications will be logged to terminal only');
    });

// ============================================
// NOTIFICATION SCHEMA (MongoDB Model)
// ============================================
const notificationSchema = new mongoose.Schema({
    student_id: Number,
    student_number: String,
    firstname: String,
    lastname: String,
    course: String,
    year: String,
    message: String,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Notification = mongoose.model('Notification', notificationSchema);

// ============================================
// RABBITMQ CONSUMER
// ============================================
let channel;
let connection;

async function connectRabbitMQ() {
    try {
        connection = await amqp.connect(process.env.RABBITMQ_URL);
        channel = await connection.createChannel();
        await channel.assertQueue('enrollment_queue');
        console.log('✅ RabbitMQ Connected - Waiting for messages...');

        // Start consuming messages
        channel.consume('enrollment_queue', async (msg) => {
            if (msg !== null) {
                const data = JSON.parse(msg.content.toString());
                console.log('\n📥 ===== NEW NOTIFICATION RECEIVED =====');
                console.log('📨 Message:', data.message);
                console.log('👤 Student:', data.firstname, data.lastname);
                console.log('📚 Course:', data.course);
                console.log('📋 Student Number:', data.student_number);
                console.log('📅 Year:', data.year);
                console.log('==========================================\n');

                // Save to MongoDB
                await saveNotification(data);

                // Acknowledge the message (remove from queue)
                channel.ack(msg);
            }
        }, { noAck: false });

    } catch (error) {
        console.log('❌ RabbitMQ Connection Error:', error.message);
        console.log('💡 Make sure RabbitMQ is running!');
        console.log('⚠️  Messages will be logged to terminal only');
    }
}

// ============================================
// SAVE NOTIFICATION TO MONGODB
// ============================================
async function saveNotification(data) {
    try {
        const notification = new Notification({
            student_id: data.student_id,
            student_number: data.student_number,
            firstname: data.firstname,
            lastname: data.lastname,
            course: data.course,
            year: data.year,
            message: data.message
        });

        await notification.save();
        console.log('💾 Notification saved to MongoDB');
    } catch (error) {
        console.log('❌ Failed to save to MongoDB:', error.message);
        console.log('⚠️  Notification saved to terminal only');
    }
}

// ============================================
// API ENDPOINTS
// ============================================

// GET all notifications
app.get('/api/notifications', async (req, res) => {
    try {
        const notifications = await Notification.find().sort({ createdAt: -1 });
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET notifications by student
app.get('/api/notifications/student/:student_number', async (req, res) => {
    try {
        const notifications = await Notification.find({ 
            student_number: req.params.student_number 
        }).sort({ createdAt: -1 });
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        rabbitmq: channel ? 'connected' : 'disconnected'
    });
});

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 3001;

app.listen(PORT, async () => {
    console.log(`\n✅ ==========================================`);
    console.log(`🚀 Notification Service is RUNNING!`);
    console.log(`📡 URL: http://localhost:${PORT}`);
    console.log(`✅ ==========================================\n`);
    
    // Connect to MongoDB
    // (Already connected above)
    
    // Connect to RabbitMQ
    await connectRabbitMQ();
    
    console.log(`\n📋 Available Endpoints:`);
    console.log(`   GET    /api/notifications                - Get all notifications`);
    console.log(`   GET    /api/notifications/student/:id    - Get student notifications`);
    console.log(`   GET    /api/health                       - Check service health`);
    console.log(`\n💡 Listening for enrollment messages...`);
});