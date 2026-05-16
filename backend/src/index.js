const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// --- API ENDPOINTS ---

/**
 * 1. POST /api/pay
 * ESP32 sends: { card_id, merchant_id, amount, idempotency_key }
 */
app.post('/api/pay', async (req, res) => {
    const { card_id, merchant_id, amount, idempotency_key } = req.body;

    if (!card_id || !merchant_id || !amount || !idempotency_key) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        // Check Idempotency - Block if PENDING or SUCCESS
        const existingTx = await client.query(
            "SELECT * FROM transactions WHERE idempotency_key = $1 AND status IN ('PENDING', 'SUCCESS')",
            [idempotency_key]
        );

        if (existingTx.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.json({
                status: existingTx.rows[0].status,
                message: 'Idempotency key already processed or in progress',
                transaction_id: existingTx.rows[0].id
            });
        }

        // Check Balance
        const cardResult = await client.query(
            'SELECT balance FROM cards WHERE card_id = $1 FOR UPDATE',
            [card_id]
        );

        if (cardResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Card not found' });
        }

        const balance = parseFloat(cardResult.rows[0].balance);
        if (balance < amount) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        // Deduct Balance
        await client.query(
            'UPDATE cards SET balance = balance - $1 WHERE card_id = $2',
            [amount, card_id]
        );

        // Record Transaction as PENDING
        const txResult = await client.query(
            'INSERT INTO transactions (card_id, merchant_id, amount, idempotency_key, status) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [card_id, merchant_id, amount, idempotency_key, 'PENDING']
        );

        await client.query('COMMIT');

        res.json({
            status: 'PENDING',
            transaction_id: txResult.rows[0].id,
            message: 'Payment deducted, awaiting gate confirmation'
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

/**
 * 2. POST /api/confirm
 * ESP32 sends: { transaction_id } after gate successfully opened
 */
app.post('/api/confirm', async (req, res) => {
    const { idempotency_key } = req.body;

    if (!idempotency_key) {
        return res.status(400).json({ error: 'Missing idempotency_key' });
    }

    try {
        const result = await db.query(
            "UPDATE transactions SET status = 'SUCCESS', updated_at = CURRENT_TIMESTAMP WHERE idempotency_key = $1 AND status = 'PENDING' RETURNING id",
            [idempotency_key]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Transaction not found or already processed' });
        }

        res.json({ status: 'SUCCESS', message: 'Gate confirmed open', transaction_id: result.rows[0].id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * 3. GET /api/user/:card_id
 * Frontend: Fetch user balance and transaction history
 */
app.get('/api/user/:card_id', async (req, res) => {
    const { card_id } = req.params;

    try {
        const cardInfo = await db.query(
            `SELECT c.balance, u.name, u.email 
             FROM cards c 
             JOIN users u ON c.user_id = u.id 
             WHERE c.card_id = $1`,
            [card_id]
        );

        if (cardInfo.rows.length === 0) {
            return res.status(404).json({ error: 'Card not found' });
        }

        const history = await db.query(
            `SELECT t.amount, t.status, t.created_at, m.name as merchant_name 
             FROM transactions t 
             JOIN merchants m ON t.merchant_id = m.id 
             WHERE t.card_id = $1 
             ORDER BY t.created_at DESC LIMIT 10`,
            [card_id]
        );

        res.json({
            user: cardInfo.rows[0],
            history: history.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// --- AUTO-REFUND WORKER ---
// Runs every minute: Checks for PENDING transactions older than 60 seconds
cron.schedule('* * * * *', async () => {
    console.log('Running Auto-Refund Worker...');
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        // Find pending transactions older than 60 seconds
        const pendingTxs = await client.query(
            "SELECT * FROM transactions WHERE status = 'PENDING' AND created_at < NOW() - INTERVAL '60 seconds' FOR UPDATE"
        );

        for (const tx of pendingTxs.rows) {
            // Refund the balance
            await client.query(
                "UPDATE cards SET balance = balance + $1 WHERE card_id = $2",
                [tx.amount, tx.card_id]
            );

            // Update status to REFUNDED
            await client.query(
                "UPDATE transactions SET status = 'REFUNDED', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
                [tx.id]
            );

            console.log(`Refunded transaction ${tx.id} for card ${tx.card_id}`);
        }

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Refund worker error:', err);
    } finally {
        client.release();
    }
});

app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
});
