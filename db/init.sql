-- Schema for IoT Smart Gate Access System

-- 1. Merchants Table
CREATE TABLE merchants (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Cards Table (RFID Cards)
CREATE TABLE cards (
    card_id VARCHAR(50) PRIMARY KEY, -- RFID UID
    user_id INTEGER REFERENCES users(id),
    balance DECIMAL(10, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Transactions Table
CREATE TYPE transaction_status AS ENUM ('PENDING', 'SUCCESS', 'REFUNDED', 'FAILED');

CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    card_id VARCHAR(50) REFERENCES cards(card_id),
    merchant_id INTEGER REFERENCES merchants(id),
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    status transaction_status DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed Data
INSERT INTO merchants (name) VALUES 
('Main Entrance Gate'), 
('VIP Lounge Gate'),
('Parking Area A');

INSERT INTO users (name, email) VALUES 
('Budi Santoso', 'budi@example.com'),
('Siti Aminah', 'siti@example.com'),
('John Doe', 'john@example.com');

-- Sample Cards (RFID UIDs)
INSERT INTO cards (card_id, user_id, balance) VALUES 
('A1B2C3D4', 1, 50000.00),
('E5F6G7H8', 2, 75000.00),
('RFID123456', 3, 100000.00); -- Matches Postman Example
