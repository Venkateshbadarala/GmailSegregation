// Import dependencies and models
const express = require('express');
const axios = require('axios');
const path = require('path');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
const { google } = require('googleapis');
require('dotenv').config();

// Import the Group and Email models
const Group = require('./models/Group');
const Email = require('./models/Email');

// Create an Express app
const app = express();
app.use(express.json());
app.use(helmet());
app.use(cors());

// Serve static files (if applicable, e.g., for a frontend React app)
app.use(express.static(path.join(__dirname, '..', 'client', 'build')));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('Connected to MongoDB');
    })
    .catch((error) => {
        console.error('Error connecting to MongoDB:', error);
    });

// Initialize Gmail client
const initializeGmailClient = (accessToken) => {
    const oauth2Client = new google.auth.OAuth2(process.env.CLIENT_ID, process.env.CLIENT_SECRET, process.env.REDIRECT_URI);
    oauth2Client.setCredentials({ access_token: accessToken });
    return google.gmail({ version: 'v1', auth: oauth2Client });
};

// Route to get all groups
// Define a route to handle GET requests to '/group'
app.get('/group', async (req, res) => {
    try {
        // Fetch all groups from the database using the Group model
        const groups = await Group.find().lean();
        
        // Return the list of groups as JSON
        res.json(groups);
    } catch (error) {
        console.error('Error fetching groups:', error);
        res.status(500).json({ error: 'Failed to fetch groups.' });
    }
});
// Route to get a specific group and its filtered emails by ID
app.get('/api/groups/:groupId/filtered-emails', async (req, res) => {
    const { groupId } = req.params;

    try {
        // Fetch the group by ID
        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({ error: 'Group not found.' });
        }

        // Fetch emails that have email addresses in the group.senderEmails list
        const filteredEmails = await Email.find({
            $or: [
                { "from": { $in: group.senderEmails } },
                { "to": { $in: group.senderEmails } }
            ]
        }).lean();

        // Return the group details and filtered emails as JSON
        res.json({
            group,
            filteredEmails,
        });
    } catch (error) {
        console.error(`Error fetching group and filtered emails with ID ${groupId}:`, error);
        res.status(500).json({ error: `Failed to fetch group and filtered emails: ${error.message}` });
    }
});


// Route to create a new group
app.post('/api/groups', async (req, res) => {
    const { groupName, senderEmails } = req.body;

    if (!groupName || !Array.isArray(senderEmails) || senderEmails.length === 0) {
        return res.status(400).json({ error: 'Group name and sender emails are required.' });
    }

    try {
        const newGroup = new Group({ name: groupName, senderEmails });
        await newGroup.save();
        res.json(newGroup);
    } catch (error) {
        console.error('Error creating group:', error);
        res.status(500).json({ error: `Failed to create group: ${error.message}` });
    }
});

// Route to get a specific group by ID
app.get('/api/groups/:groupId', async (req, res) => {
    const { groupId } = req.params;

    try {
        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({ error: 'Group not found.' });
        }

        res.json(group);
    } catch (error) {
        console.error(`Error fetching group with ID ${groupId}:`, error);
        res.status(500).json({ error: `Failed to fetch group: ${error.message}` });
    }
});

// Route to get emails for a specific group by ID
app.get('/api/groups/:groupId/emails', async (req, res) => {
    const { groupId } = req.params;

    try {
        const emails = await Email.find({ groupId }).lean();
        res.json(emails);
    } catch (error) {
        console.error(`Error fetching emails for group ${groupId}:`, error);
        res.status(500).json({ error: 'Failed to fetch emails.' });
    }
});

// Route to get email details by ID
app.get('/api/emails/:emailId', async (req, res) => {
    const { emailId } = req.params;

    try {
        const email = await Email.findById(emailId);

        if (!email) {
            return res.status(404).json({ error: 'Email not found.' });
        }

        res.json(email);
    } catch (error) {
        console.error(`Error fetching email with ID ${emailId}:`, error);
        res.status(500).json({ error: `Failed to fetch email: ${error.message}` });
    }
});
app.get('/api/mails', async (req, res) => {
    const accessToken = req.headers.authorization?.replace('Bearer ', '');

    if (!accessToken) return res.status(401).json({ error: 'Access token is required.' });

    try {
        const gmail = initializeGmailClient(accessToken);
        const listResponse = await gmail.users.messages.list({ userId: 'me', maxResults: 20 });

        if (!listResponse.data.messages) return res.status(404).json({ error: 'No messages found.' });

        const emailDetails = await Promise.all(
            listResponse.data.messages.map(async ({ id }) => {
                try {
                    const response = await gmail.users.messages.get({ userId: 'me', id });
                    const emailData = response.data;

                    // Extract email details
                    const headers = emailData.payload.headers;
                    const sender = headers.find(header => header.name === 'From')?.value || 'Unknown sender';
                    const subject = headers.find(header => header.name === 'Subject')?.value || 'No subject';
                    const date = headers.find(header => header.name === 'Date')?.value || 'Unknown date';

                    // Extract email body
                    const bodyPart = emailData.payload.parts?.find(part => part.mimeType === 'text/plain') || emailData.payload.parts?.find(part => part.mimeType === 'text/html');
                    let body = '';
                    if (bodyPart && bodyPart.body && bodyPart.body.data) {
                        body = Buffer.from(bodyPart.body.data, 'base64').toString('utf8');
                    }

                    return { id, sender, subject, date, body };
                } catch (error) {
                    console.error(`Error fetching email with ID ${id}:`, error);
                    return null;
                }
            })
        );

        res.json(emailDetails.filter(email => email !== null));
    } catch (error) {
        console.error('Error retrieving mail data:', error);
        res.status(500).json({ error: `Error retrieving mail data: ${error.message}` });
    }
});


// Route to get a specific group and its filtered emails by ID
app.get('/api/groups/:groupId/filtered-emails', async (req, res) => {
    const { groupId } = req.params;

    try {
        // Fetch the group by ID
        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({ error: 'Group not found.' });
        }

        // Fetch emails that have sender email addresses in the group.senderEmails list
        const filteredEmails = await Email.find({
            $or: [
                { "from": { $in: group.senderEmails } },
                { "to": { $in: group.senderEmails } }
            ]
        }).lean();

        // Return the group details and filtered emails as JSON
        res.json({
            group,
            filteredEmails,
        });
    } catch (error) {
        console.error(`Error fetching group and filtered emails with ID ${groupId}:`, error);
        res.status(500).json({ error: `Failed to fetch group and filtered emails: ${error.message}` });
    }
});


// Endpoint to search emails by query
app.get('/api/search-emails', async (req, res) => {
    const accessToken = req.headers.authorization?.replace('Bearer ', '');

    if (!accessToken) {
        return res.status(401).json({ error: 'Access token is required.' });
    }

    const { query } = req.query;

    if (!query) {
        return res.status(400).json({ error: 'Search query is required.' });
    }

    try {
        const gmail = initializeGmailClient(accessToken);
        const searchResponse = await gmail.users.messages.list({
            userId: 'me',
            q: query,
        });

        const messages = searchResponse.data.messages;

        if (!messages) {
            return res.status(404).json({ error: 'No messages found.' });
        }

        const emailDetails = await Promise.all(
            messages.map(async ({ id }) => {
                try {
                    const response = await gmail.users.messages.get({ userId: 'me', id });
                    const emailData = response.data;

                    // Extract email details
                    const headers = emailData.payload.headers;
                    const sender = headers.find(header => header.name === 'From')?.value || 'Unknown sender';
                    const subject = headers.find(header => header.name === 'Subject')?.value || 'No subject';
                    const date = headers.find(header => header.name === 'Date')?.value || 'Unknown date';

                    // Extract email body
                    let body = '';
                    if (emailData.payload.parts) {
                        const textPart = emailData.payload.parts.find(part => part.mimeType === 'text/plain') || emailData.payload.parts.find(part => part.mimeType === 'text/html');
                        if (textPart && textPart.body && textPart.body.data) {
                            body = Buffer.from(textPart.body.data, 'base64').toString('utf8');
                        }
                    } else if (emailData.payload.body && emailData.payload.body.data) {
                        body = Buffer.from(emailData.payload.body.data, 'base64').toString('utf8');
                    }

                    return {
                        id,
                        sender,
                        subject,
                        date,
                        body,
                    };
                } catch (error) {
                    console.error(`Error fetching email with ID ${id}:`, error);
                    return null;
                }
            })
        );

        res.json(emailDetails.filter(email => email !== null));
    } catch (error) {
        console.error('Error searching emails:', error);
        res.status(500).json({ error: `Error searching emails: ${error.message}` });
    }
});

// Endpoint to handle token exchange
app.post('/api/get-token', async (req, res) => {
    const { code } = req.body;

    if (!code) {
        return res.status(400).json({ error: 'Authorization code is required.' });
    }

    try {
        const response = await axios.post('https://oauth2.googleapis.com/token', {
            code,
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
            redirect_uri: process.env.REDIRECT_URI,
            grant_type: 'authorization_code',
        });

        const { access_token: accessToken } = response.data;
        res.json({ accessToken });
    } catch (error) {
        console.error('Failed to exchange token:', error);
        res.status(500).json({ error: `Failed to exchange token: ${error.message}` });
    }
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
