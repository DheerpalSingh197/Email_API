const express = require('express');
const dotenv = require('dotenv');
const mysql = require('mysql2');
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const cors = require('cors');

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// MySQL Database Connection
const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL');
});

// Email Fetching Function with Duplicate Check
const fetchEmails = (imap) => {
    imap.search(['UNSEEN'], function (err, results) {
        if (err) {
            console.error('Error searching for emails:', err);
            return;
        }

        if (results.length === 0) {
            console.log('No new emails.');
            return;
        }

        const f = imap.fetch(results, { bodies: '' });

        f.on('message', function (msg, seqno) {
            msg.on('body', function (stream) {
                simpleParser(stream, (err, parsed) => {
                    if (err) {
                        console.error('Error parsing email:', err);
                        return;
                    }

                    const messageId = parsed.messageId;

                    // Check if email with the same messageId already exists in the database
                    const checkQuery = 'SELECT COUNT(*) AS count FROM emails WHERE message_id = ?';
                    connection.query(checkQuery, [messageId], (err, results) => {
                        if (err) {
                            console.error('Error checking for duplicate email:', err);
                            return;
                        }

                        if (results[0].count === 0) {
                            const emailData = {
                                subject: parsed.subject,
                                sender: parsed.from.text,
                                body: parsed.text,
                                received_date: new Date(),
                                message_id: messageId
                            };

                            const query = 'INSERT INTO emails SET ?';
                            connection.query(query, emailData, (err, results) => {
                                if (err) {
                                    console.error('Error storing email in database:', err);
                                    return;
                                }
                                console.log('Email stored in database with ID:', results.insertId);
                            });
                        } else {
                            console.log('Duplicate email detected. Skipping insertion.');
                        }
                    });
                });
            });
        });

        f.once('end', function () {
            console.log('Done fetching all unseen messages.');
        });
    });
};

// Function watch for new emails
const startIdle = () => {
    const imap = new Imap({
        user: process.env.GMAIL_USER,
        password: process.env.GMAIL_PASSWORD,
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
        tlsOptions: { rejectUnauthorized: false }
    });

    imap.once('ready', function () {
        imap.openBox('INBOX', true, function (err, box) {
            if (err) {
                console.error('Error opening inbox:', err);
                return;
            }

            // Fetch and store existing unseen emails on start
            fetchEmails(imap);

            // Start listening for new emails
            imap.on('mail', () => {
                console.log('New email detected.');
                fetchEmails(imap);
            });
        });
    });

    imap.once('error', function (err) {
        console.error('IMAP Error:', err);
    });

    imap.once('end', function () {
        console.log('Connection ended. Reconnecting...');
        setTimeout(startIdle, 5000); // Reconnect after 5 seconds
    });

    imap.connect();
};

// Start listening for new emails
startIdle();

// API Route to Fetch Emails with Filtering
app.get('/api/emails', (req, res) => {
    const { search, offset = 0, limit = 10 } = req.query;
    let query = `
        SELECT id, subject, sender, body
        FROM emails
        WHERE 
            LOWER(subject) LIKE LOWER(?) OR
            LOWER(sender) LIKE LOWER(?) OR
            LOWER(body) LIKE LOWER(?)
       order by id desc LIMIT ? OFFSET ?
    `;

    const searchTerm = `%${search}%`;

    connection.query(query, [searchTerm, searchTerm, searchTerm, parseInt(limit), parseInt(offset)], (err, results) => {
        if (err) {
            console.error('Error fetching emails:', err);
            res.status(500).send('Error fetching emails');
            return;
        }

        // Get total count for pagination
        connection.query('SELECT COUNT(*) AS total FROM emails WHERE LOWER(subject) LIKE LOWER(?) OR LOWER(sender) LIKE LOWER(?) OR LOWER(body) LIKE LOWER(?)', [searchTerm, searchTerm, searchTerm], (err, countResults) => {
            if (err) {
                console.error('Error counting emails:', err);
                res.status(500).send('Error counting emails');
                return;
            }
            const total = countResults[0].total;
            res.json({ emails: results, total });
        });
    });
});

// Start the Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
