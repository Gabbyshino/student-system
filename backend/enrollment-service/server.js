const express = require('express');
const mysql = require('mysql2');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const dotenv = require('dotenv');
const amqp = require('amqplib');

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());

// ============================================
// DATABASE CONNECTION - MySQL
// ============================================
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

db.connect(err => {
    if (err) {
        console.log('❌ MySQL Connection Error:', err.message);
        return;
    }
    console.log('✅ MySQL Connected successfully');
});

// ============================================
// RABBITMQ CONNECTION
// ============================================
let channel;

async function connectRabbitMQ() {
    try {
        const connection = await amqp.connect(process.env.RABBITMQ_URL);
        channel = await connection.createChannel();
        await channel.assertQueue('enrollment_queue');
        console.log('✅ RabbitMQ Connected');
    } catch (error) {
        console.log('❌ RabbitMQ Connection Error:', error.message);
        console.log('⚠️  Messages will be logged only');
    }
}

// ============================================
// JWT AUTHENTICATION
// ============================================
const JWT_SECRET = process.env.JWT_SECRET;

function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.replace('Bearer ', '');
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Invalid token' });
    }
}

// ============================================
// CREATE USERS TABLE & DEFAULT USER
// ============================================
async function createDefaultUser() {
    const createTableSQL = `
        CREATE TABLE IF NOT EXISTS users (
            id INT PRIMARY KEY AUTO_INCREMENT,
            username VARCHAR(100) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;
    db.query(createTableSQL, async (err) => {
        if (err) {
            console.log('❌ Error creating users table:', err.message);
            return;
        }
        console.log('✅ Users table ready');

        // Check if admin exists
        db.query('SELECT * FROM users WHERE username = ?', ['admin'], async (err, results) => {
            if (err) return;
            if (results.length === 0) {
                const hashedPassword = await bcrypt.hash('admin123', 10);
                db.query('INSERT INTO users (username, password) VALUES (?, ?)', ['admin', hashedPassword]);
                console.log('✅ Default user created: admin / admin123');
            }
        });
    });
}

// ============================================
// LOGIN ENDPOINT
// ============================================
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    db.query('SELECT * FROM users WHERE username = ?', [username], async (err, results) => {
        if (err || results.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isValid = await bcrypt.compare(password, results[0].password);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: results[0].id, username: results[0].username },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ token, user: { id: results[0].id, username: results[0].username } });
    });
});

// ============================================
// PUBLIC ENDPOINTS
// ============================================

// GET all students
app.get('/api/students', (req, res) => {
    db.query('SELECT * FROM students ORDER BY student_id', (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(results);
    });
});

// GET student by ID
app.get('/api/students/:id', (req, res) => {
    db.query('SELECT * FROM students WHERE student_id = ?', [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (results.length === 0) return res.status(404).json({ error: 'Student not found' });
        res.json(results[0]);
    });
});

// ============================================
// PROTECTED ENDPOINTS (JWT Required)
// ============================================

// POST - Enroll student
app.post('/api/students', verifyToken, (req, res) => {
    const { student_number, firstname, lastname, course, year } = req.body;

    if (!student_number || !firstname || !lastname || !course || !year) {
        return res.status(400).json({ error: 'All fields required' });
    }

    db.query('SELECT * FROM students WHERE student_number = ?', [student_number], (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (results.length > 0) {
            return res.status(400).json({ error: 'Student number already exists' });
        }

        const sql = `INSERT INTO students (student_number, firstname, lastname, course, year, status) 
                     VALUES (?, ?, ?, ?, ?, 'Pending')`;
        db.query(sql, [student_number, firstname, lastname, course, year], (err, result) => {
            if (err) return res.status(500).json({ error: 'Database error' });

            db.query('SELECT * FROM students WHERE student_id = ?', [result.insertId], (err, student) => {
                if (err) return res.status(500).json({ error: 'Database error' });

                // Send to RabbitMQ
                sendToQueue({
                    student_id: student[0].student_id,
                    student_number: student[0].student_number,
                    firstname: student[0].firstname,
                    lastname: student[0].lastname,
                    course: student[0].course,
                    year: student[0].year,
                    message: `New Student Enrolled: ${student[0].firstname} ${student[0].lastname}`
                });

                res.status(201).json({ message: 'Student enrolled successfully!', student: student[0] });
            });
        });
    });
});

// PUT - Update student
app.put('/api/students/:id', verifyToken, (req, res) => {
    const { firstname, lastname, course, year, status } = req.body;
    const studentId = req.params.id;

    db.query('UPDATE students SET firstname=?, lastname=?, course=?, year=?, status=? WHERE student_id=?',
        [firstname, lastname, course, year, status, studentId], (err) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ message: 'Student updated successfully!' });
        });
});

// DELETE - Delete student
app.delete('/api/students/:id', verifyToken, (req, res) => {
    db.query('DELETE FROM students WHERE student_id = ?', [req.params.id], (err, result) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Student not found' });
        res.json({ message: 'Student deleted successfully!' });
    });
});

// ============================================
// RABBITMQ - Send message
// ============================================
async function sendToQueue(data) {
    if (channel) {
        try {
            channel.sendToQueue('enrollment_queue', Buffer.from(JSON.stringify(data)));
            console.log('📨 Message sent to RabbitMQ:', data.message);
        } catch (error) {
            console.log('❌ Failed to send:', error.message);
        }
    } else {
        console.log('📨 [QUEUE DISABLED]', data.message);
    }
}

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`\n✅ ==========================================`);
    console.log(`🚀 Enrollment Service is RUNNING!`);
    console.log(`📡 http://localhost:${PORT}`);
    console.log(`✅ ==========================================\n`);
    await connectRabbitMQ();
    await createDefaultUser();
    console.log(`\n📋 Endpoints:`);
    console.log(`   POST   /api/login          - Login (admin/admin123)`);
    console.log(`   GET    /api/students       - List students`);
    console.log(`   POST   /api/students       - Enroll student (JWT)`);
    console.log(`   PUT    /api/students/:id   - Update student (JWT)`);
    console.log(`   DELETE /api/students/:id   - Delete student (JWT)`);
    console.log(`\n💡 Default login: admin / admin123`);
});