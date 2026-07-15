# Student Enrollment System

A microservices-based student enrollment system with notification integration for educational institutions.

---

## Features

- Student Enrollment (Create, Read, Update, Delete)
- JWT Authentication and Authorization
- Asynchronous Notifications via RabbitMQ
- MySQL and MongoDB Integration
- Data Synchronization between Databases
- Professional Web Interface

---

## Technologies

| Component | Technology |
|-----------|------------|
| Backend | Node.js + Express |
| Authentication | JWT + bcrypt |
| Primary Database | MySQL |
| Secondary Database | MongoDB |
| Message Queue | RabbitMQ |
| Frontend | HTML + CSS + JavaScript |
| API Testing | Postman |

---

## Architecture Overview

The system follows a Microservices Architecture with two independent services:

1. **Enrollment Service (Port 3000):** Handles student CRUD operations and authentication
2. **Notification Service (Port 3001):** Processes enrollment events and logs notifications

### Data Flow
Client → Enrollment Service → MySQL → RabbitMQ → Notification Service → MongoDB

---

## Prerequisites

| Software | Version |
|----------|---------|
| Node.js | v18+ |
| MySQL | 8.0+ |
| MongoDB | 6.0+ |
| RabbitMQ | 3.12+ |
| Git | Latest |

---

## Setup Instructions

### 1. Clone the Repository
git clone https://github.com/GabbyShino/student-enrollment-system.git
cd student-enrollment-system

### 2. Setup MySQL Database
mysql -u root -p
CREATE DATABASE enrollment_db;
USE enrollment_db;

Run the SQL scripts from the documentation to create tables.

### 3. Setup MongoDB
mongosh
use notification_db

### 4. Start RabbitMQ
rabbitmq-server

### 5. Install and Run Enrollment Service
cd backend/enrollment-service
npm install
npm start

### 6. Install and Run Notification Service
cd backend/notification-service
npm install
npm start

### 7. Access Frontend
Open frontend/index.html in your browser or use Live Server.

---

## Environment Variables

### Enrollment Service (.env)
PORT=3000
JWT_SECRET=your-super-secret-key
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=enrollment_db
RABBITMQ_URL=amqp://localhost

### Notification Service (.env)
PORT=3001
MONGO_URI=mongodb://localhost:27017/notification_db
RABBITMQ_URL=amqp://localhost

---

## Default Login

| Username | Password |
|----------|----------|
| admin | admin123 |

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/login | No | Login and get JWT token |
| GET | /api/students | No | Get all students |
| GET | /api/students/:id | No | Get student by ID |
| POST | /api/students | Yes | Enroll new student |
| PUT | /api/students/:id | Yes | Update student |
| DELETE | /api/students/:id | Yes | Delete student |

---

## Project Structure

```
student-system/
├── backend/
│   ├── enrollment-service/
│   │   ├── server.js
│   │   ├── package.json
│   │   └── .env
│   └── notification-service/
│       ├── server.js
│       ├── package.json
│       └── .env
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── script.js
└── README.md
```
---

## Team Members

| Name | Role |
|------|------|
| Maningo, Gabriel | Lead Developer |
| Custorio, April Nicole | Frontend Developer |
| Dela Cruz, Junelle | Database Administrator |
| Santos, Maureen | Tester/QA |

---

## License

This project is for educational purposes only.

---

## Submission

- Repository: https://github.com/GabbyShino/student-enrollment-system
- Instructor: Mr. Joemel Atiga
- Course: PC24 - System Integration and Architecture

